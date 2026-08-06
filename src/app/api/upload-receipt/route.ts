import { after, NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { sendOrderApprovalNotification } from "@/lib/telegram";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { enforceRateLimit } from "@/utils/security/rate-limit";
import { isAdminEmail } from "@/utils/security/admin";
import { resolveSmmServiceTitle } from "@/lib/smmServiceResolver";
import { buildReceiptFileName, findActiveDuplicateReceiptRecord, hashReceiptFile } from "@/lib/receiptGuard";
import { notifyCustomer, notifyOrderStatusCustomer } from "@/lib/customerNotifications";
import { compressReceiptImage, bufferToDataUrl } from "@/utils/serverImageCompressor";
import { syncBackupAdminClients } from "@/utils/supabase/dual-db";
import { autoVerifyAndApproveOrder } from "@/lib/receiptVerifier";
import { autoPlaceRixeyOrder } from "@/lib/rixeysmm";
import { creditReferralCommission } from "@/utils/referrals";
import { sendOrderApprovedEmail } from "@/lib/approvalEmails";
import { recordOrderEvent } from "@/lib/orderEvents";

const MAX_RECEIPT_FILE_BYTES = 8 * 1024 * 1024;
const ALLOWED_RECEIPT_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

async function updateOrderReceipt(
  supabase: SupabaseClient,
  orderId: string,
  receiptUrl: string,
  receiptHash: string
) {
  const { error } = await supabase
    .from("orders")
    .update({ receipt_url: receiptUrl, receipt_hash: receiptHash })
    .eq("id", orderId);

  if (!error) return;

  if (/receipt_hash|schema cache/i.test(error.message || "")) {
    const fallback = await supabase
      .from("orders")
      .update({ receipt_url: receiptUrl })
      .eq("id", orderId);
    if (!fallback.error) return;
    throw fallback.error;
  }

  throw error;
}

export async function POST(req: NextRequest) {
  try {
    const rateLimitResponse = enforceRateLimit(req, {
      key: "upload-receipt",
      maxRequests: 20,
      windowMs: 10 * 60_000,
    });
    if (rateLimitResponse) return rateLimitResponse;

    const sessionClient = await createServerClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();
    if (!user?.email) {
      return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const orderId = formData.get("orderId") as string | null;

    if (!file || !orderId) {
      return NextResponse.json({ error: "Missing file or orderId" }, { status: 400 });
    }

    if (!ALLOWED_RECEIPT_TYPES.has(file.type.toLowerCase())) {
      return NextResponse.json({ error: "Invalid receipt file type." }, { status: 400 });
    }

    if (file.size <= 0 || file.size > MAX_RECEIPT_FILE_BYTES) {
      return NextResponse.json({ error: "Receipt file is too large. Maximum is 8MB." }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Supabase environment variables missing on server!");
      return NextResponse.json({ error: "Server configuration missing" }, { status: 500 });
    }

    // Initialize administrative client bypassing RLS policies
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false
      }
    });

    // 1. Fetch the customer email associated with this order to personalize the receipt file
    const { data: orderData, error: fetchError } = await supabase
      .from("orders")
      .select(`
        id,
        status,
        customer_email,
        payment_method,
        amount,
        quantity,
        target_url,
        service_id,
        smm_service_id,
        external_order_id,
        services (
          title
        )
      `)
      .eq("id", orderId)
      .single();

    if (fetchError || !orderData) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    const requesterEmail = user.email.trim().toLowerCase();
    const orderEmail = String(orderData.customer_email || "").trim().toLowerCase();
    if (!isAdminEmail(requesterEmail) && requesterEmail !== orderEmail) {
      return NextResponse.json({ error: "You can only upload receipts for your own order." }, { status: 403 });
    }

    const email = orderData?.customer_email ? orderData.customer_email.trim() : "unknown";
    const receiptHash = await hashReceiptFile(file);
    // Only block reuse when a prior transaction with this hash is still ACTIVE
    // (pending/processing/completed/approved). Rejected/cancelled/failed rows do
    // not block the customer — the payment was never consumed.
    const duplicateReceipt = await findActiveDuplicateReceiptRecord(supabase, receiptHash, orderId);

    if (duplicateReceipt) {
      return NextResponse.json({
        error: "This receipt image was already used on another order or top-up. Please upload the correct payment proof for this transaction.",
      }, { status: 409 });
    }

    // Server-side compression: guarantees a compact JPEG is stored regardless
    // of whether the client compressed. Hash stays on the original bytes so
    // duplicate detection remains consistent across uploads.
    const compressed = await compressReceiptImage(file);

    // 2. Name the file [orderId]_[email].[ext] to instantly identify who is paying in the storage bucket
    const fileName = buildReceiptFileName(orderId, receiptHash, email, compressed.extension);

    let uploadData: { path?: string; fullPath?: string } | null = null;
    let receiptUrl = "";

    try {
      const { data, error } = await supabase.storage
        .from('receipts')
        .upload(fileName, compressed.buffer, {
          upsert: true,
          contentType: compressed.mimeType,
        });

      if (error) throw error;

      uploadData = data;
      const { data: publicUrlData } = supabase.storage
        .from("receipts")
        .getPublicUrl(fileName);
      receiptUrl = publicUrlData.publicUrl;
    } catch (storageError) {
      console.warn("Receipt storage upload failed; falling back to inline receipt data:", storageError);
      receiptUrl = bufferToDataUrl(compressed.buffer, compressed.mimeType);
      uploadData = { path: `inline:${orderId}` };
    }

    await updateOrderReceipt(supabase, orderId, receiptUrl, receiptHash);

    let autoApproval: Awaited<ReturnType<typeof autoVerifyAndApproveOrder>> | null = null;
    const isReceiptPaidOrder = String(orderData?.payment_method || "").toLowerCase() !== "wallet";
    const orderAmount = Number(orderData?.amount || 0);

    if (isReceiptPaidOrder && String(orderData.status || "") === "Pending" && orderAmount > 0) {
      try {
        autoApproval = await autoVerifyAndApproveOrder({
          supabase,
          orderId,
          requestedAmount: orderAmount,
          imageBuffer: compressed.buffer,
          mimeType: compressed.mimeType,
          userEmail: email,
        });
      } catch (ocrErr) {
        console.error("AI order receipt verification failed (graceful fallback):", ocrErr);
      }
    }

    const extractedAmount = autoApproval?.extractedAmount ?? null;
    const amountMatches =
      extractedAmount === null || orderAmount <= 0
        ? null
        : Math.abs(extractedAmount - orderAmount) <=
          Math.max(orderAmount * 0.05, 0.5);
    const rejectedAsFake = Boolean(
      autoApproval && "rejectedAsFake" in autoApproval && autoApproval.rejectedAsFake
    );
    const rejectedAsDuplicate = Boolean(
      autoApproval && "rejectedAsDuplicate" in autoApproval && autoApproval.rejectedAsDuplicate
    );
    const receiptAnalysis = {
      model: autoApproval?.providerModel || null,
      decision: autoApproval?.autoApproved
        ? "approved"
        : rejectedAsFake
          ? "rejected_fake"
          : rejectedAsDuplicate
            ? "rejected_duplicate"
            : "manual_review",
      verified: Boolean(autoApproval?.success),
      autoApproved: Boolean(autoApproval?.autoApproved),
      extractedAmount,
      confidence: autoApproval?.confidence ?? 0,
      amountMatches,
      receiverName: autoApproval?.receiverName || null,
      receiverAccount: autoApproval?.receiverAccount || null,
      receiverInstitution: autoApproval?.receiverInstitution || null,
      paymentRail: autoApproval?.paymentRail || null,
      receiverMatched: Boolean(autoApproval?.receiverMatched),
      referenceNumber: autoApproval?.referenceNumber || null,
      referenceUnique: Boolean(autoApproval?.referenceUnique),
      isAIGenerated: Boolean(autoApproval?.isAIGenerated),
      reason: autoApproval?.reason || "Kimi could not complete the receipt check.",
      requiresManualReview: !autoApproval?.autoApproved &&
        !rejectedAsFake &&
        !rejectedAsDuplicate,
    };
    const decidedOrderStatus = autoApproval?.autoApproved
      ? "Processing"
      : rejectedAsFake || rejectedAsDuplicate
        ? "Rejected"
        : null;

    after(async () => {
      await syncBackupAdminClients(async (backupClient) => {
        return backupClient
          .from("orders")
          .update({
            receipt_url: receiptUrl,
            receipt_hash: receiptHash,
            ...(decidedOrderStatus ? { status: decidedOrderStatus } : {}),
          })
          .eq("id", orderId);
      }, "order receipt sync");
    });

    // Timeline events for the receipt upload outcome.
    if (decidedOrderStatus === "Processing") {
      recordOrderEvent({
        client: supabase,
        orderId,
        eventType: "payment_received",
        fromStatus: "Pending",
        toStatus: "Processing",
        detail: "Payment receipt verified",
      }).catch((eventErr) => {
        console.error("Receipt payment event failed:", eventErr);
      });
    } else if (decidedOrderStatus === "Rejected") {
      recordOrderEvent({
        client: supabase,
        orderId,
        eventType: "rejected",
        fromStatus: "Pending",
        toStatus: "Rejected",
        detail: "Payment receipt rejected",
      }).catch((eventErr) => {
        console.error("Receipt reject event failed:", eventErr);
      });
    } else {
      recordOrderEvent({
        client: supabase,
        orderId,
        eventType: "payment_pending",
        fromStatus: "Pending",
        toStatus: "Pending",
        detail: "Payment receipt uploaded — awaiting verification",
      }).catch((eventErr) => {
        console.error("Receipt pending event failed:", eventErr);
      });
    }

    after(async () => {
      try {
        const trackingId = `BS-${orderId.slice(0, 8).toUpperCase()}`;
        const orderServices = (orderData as {
          services?: { title?: string } | Array<{ title?: string }>;
        }).services;
        const serviceTitle = Array.isArray(orderServices)
          ? orderServices[0]?.title
          : orderServices?.title;
        const resolvedServiceTitle = await resolveSmmServiceTitle(
          orderData.smm_service_id,
          serviceTitle || "SMM Service"
        );

        if (isReceiptPaidOrder) {
          await sendOrderApprovalNotification({
            orderId,
            trackingId,
            service: resolvedServiceTitle,
            email,
            quantity: Number(orderData?.quantity || 0),
            amount: orderAmount,
            paymentMethod: orderData?.payment_method || "GCash",
            receiptUrl,
            details: orderData?.target_url || undefined,
            autoApproved: Boolean(autoApproval?.autoApproved),
            aiReason: autoApproval?.reason || undefined,
            receiverName: autoApproval?.receiverName || undefined,
            referenceNumber: autoApproval?.referenceNumber || undefined,
          });
        }

        if (autoApproval?.autoApproved) {
          notifyOrderStatusCustomer({
            client: supabase,
            email,
            trackingId,
            status: "Processing",
          }).catch((err) => console.error("Auto-approved order status notify failed:", err));

          sendOrderApprovedEmail({
            email,
            trackingId,
            serviceTitle: resolvedServiceTitle,
            amount: orderAmount,
          }).catch((err) => console.error("Auto-approved order email failed:", err));

          try {
            await creditReferralCommission({
              primaryClient: supabase,
              customerEmail: email,
              source: "order",
              amount: orderAmount,
              referenceId: orderId,
            });
          } catch (commissionError) {
            console.error("Auto-approved order referral commission failed:", commissionError);
          }

          if (!orderData.external_order_id) {
            autoPlaceRixeyOrder(
              orderId,
              orderData.service_id,
              orderData.target_url,
              Number(orderData.quantity || 0)
            ).catch((err) => {
              console.error("Auto-placement after AI order approval failed:", err);
            });
          }
        } else if (rejectedAsFake || rejectedAsDuplicate) {
          await notifyCustomer({
            client: supabase,
            email,
            message: `System update: Payment proof for order ${trackingId} was rejected. ${autoApproval?.reason || "The receipt did not pass the verification rules."}`,
          });
        } else {
          await notifyCustomer({
            client: supabase,
            email,
            message: `System update: Receipt uploaded for order ${trackingId}. Admin will verify it shortly.`,
          });
        }
      } catch (notificationErr) {
        console.error("Post-receipt notification tasks failed:", notificationErr);
      }
    });

    return NextResponse.json({
      success: true,
      data: uploadData,
      email,
      receiptUrl,
      autoApproved: autoApproval?.autoApproved ?? false,
      aiReason: autoApproval?.reason ?? null,
      receiptAnalysis,
    });
  } catch (err: unknown) {
    console.error("Upload endpoint failed:", err);
    const message = err instanceof Error
      ? err.message
      : typeof err === "object"
        ? JSON.stringify(err)
        : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
