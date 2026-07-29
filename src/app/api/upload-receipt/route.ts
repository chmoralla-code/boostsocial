import { after, NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendOrderApprovalNotification } from "@/lib/telegram";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { enforceRateLimit } from "@/utils/security/rate-limit";
import { isAdminEmail } from "@/utils/security/admin";
import { resolveSmmServiceTitle } from "@/lib/smmServiceResolver";
import { buildReceiptFileName, findActiveDuplicateReceiptRecord, hashReceiptFile } from "@/lib/receiptGuard";
import { notifyCustomer } from "@/lib/customerNotifications";
import { compressReceiptImage, bufferToDataUrl } from "@/utils/serverImageCompressor";
import { syncBackupAdminClients } from "@/utils/supabase/dual-db";
import { verifyReceipt } from "@/lib/receiptVerifier";

const MAX_RECEIPT_FILE_BYTES = 8 * 1024 * 1024;
const ALLOWED_RECEIPT_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

async function updateOrderReceipt(
  supabase: any,
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
        customer_email,
        payment_method,
        amount,
        quantity,
        target_url,
        smm_service_id,
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
        error: "This receipt image was already used on another order or top-up. Please upload the correct GCash proof for this transaction.",
      }, { status: 409 });
    }

    // Server-side compression: guarantees a compact JPEG is stored regardless
    // of whether the client compressed. Hash stays on the original bytes so
    // duplicate detection remains consistent across uploads.
    const compressed = await compressReceiptImage(file);
    // Start Kimi's visual pre-check while the receipt is being stored. Its
    // result is advisory only; admin review remains authoritative for orders.
    const verificationPromise = verifyReceipt(
      compressed.buffer,
      compressed.mimeType
    );

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
    const verification = await verificationPromise;
    const expectedAmount = Number(orderData?.amount || 0);
    const amountMatches =
      verification.extractedAmount === null || expectedAmount <= 0
        ? null
        : Math.abs(verification.extractedAmount - expectedAmount) <=
          Math.max(expectedAmount * 0.05, 0.01);
    const receiptAnalysis = {
      model: verification.providerModel,
      verified: verification.success,
      extractedAmount: verification.extractedAmount,
      confidence: verification.confidence,
      amountMatches,
      requiresManualReview:
        !verification.success ||
        amountMatches !== true ||
        verification.isAIGenerated === true ||
        (verification.tamperingScore ?? 0) >= 70,
    };

    after(async () => {
      await syncBackupAdminClients(async (backupClient) => {
        return backupClient
          .from("orders")
          .update({ receipt_url: receiptUrl, receipt_hash: receiptHash })
          .eq("id", orderId);
      }, "order receipt sync");
    });

    after(async () => {
      try {
        if (orderData?.payment_method !== "Wallet") {
          const serviceTitle = Array.isArray((orderData as any)?.services)
            ? (orderData as any).services[0]?.title
            : (orderData as any)?.services?.title;

          const resolvedServiceTitle = await resolveSmmServiceTitle(
            orderData.smm_service_id,
            serviceTitle || "SMM Service"
          );

          await sendOrderApprovalNotification({
            orderId,
            trackingId: `BS-${orderId.slice(0, 8).toUpperCase()}`,
            service: resolvedServiceTitle,
            email,
            quantity: Number(orderData?.quantity || 0),
            amount: Number(orderData?.amount || 0),
            paymentMethod: orderData?.payment_method || "GCash",
            receiptUrl,
            details: orderData?.target_url || undefined,
          });
        }

        await notifyCustomer({
          client: supabase,
          email,
          message: `System update: Receipt uploaded for order BS-${orderId.slice(0, 8).toUpperCase()}. Admin will verify it shortly.`,
        });
      } catch (notificationErr) {
        console.error("Post-receipt notification tasks failed:", notificationErr);
      }
    });

    return NextResponse.json({
      success: true,
      data: uploadData,
      email,
      receiptUrl,
      receiptAnalysis,
    });
  } catch (err: any) {
    console.error("Upload endpoint failed:", err);
    return NextResponse.json({ error: err?.message || (typeof err === "object" ? JSON.stringify(err) : String(err)) }, { status: 500 });
  }
}
