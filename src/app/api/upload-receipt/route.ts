import { after, NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendOrderApprovalNotification } from "@/lib/telegram";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { enforceRateLimit } from "@/utils/security/rate-limit";
import { isAdminEmail } from "@/utils/security/admin";
import { resolveSmmServiceTitle } from "@/lib/smmServiceResolver";
import { buildReceiptFileName, findDuplicateReceipt, hashReceiptFile } from "@/lib/receiptGuard";
import { notifyCustomer } from "@/lib/customerNotifications";
import { fileToDataUrl } from "@/lib/fileData";
import { syncBackupAdminClients } from "@/utils/supabase/dual-db";

const MAX_RECEIPT_FILE_BYTES = 8 * 1024 * 1024;
const ALLOWED_RECEIPT_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

async function findDuplicateReceiptRecord(supabase: any, receiptHash: string, orderId: string) {
  try {
    const [orders, topups, vipSubscriptions] = await Promise.all([
      supabase.from("orders").select("id").eq("receipt_hash", receiptHash).neq("id", orderId).limit(1),
      supabase.from("topups").select("id").eq("receipt_hash", receiptHash).limit(1),
      supabase.from("vip_subscriptions").select("id").eq("receipt_hash", receiptHash).limit(1),
    ]);

    const orderRows = orders.data as Array<{ id?: string }> | null;
    const topupRows = topups.data as Array<{ id?: string }> | null;
    const vipRows = vipSubscriptions.data as Array<{ id?: string }> | null;

    if (orderRows?.length) return orderRows[0]?.id || "order";
    if (topupRows?.length) return topupRows[0]?.id || "topup";
    if (vipRows?.length) return vipRows[0]?.id || "vip";
  } catch (error) {
    console.warn("Receipt hash duplicate lookup skipped:", error);
  }

  return null;
}

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
    const fileExt = file.name.split('.').pop() || 'png';
    const receiptHash = await hashReceiptFile(file);
    const duplicateReceipt = await findDuplicateReceipt(supabase, receiptHash, orderId)
      || await findDuplicateReceiptRecord(supabase, receiptHash, orderId);

    if (duplicateReceipt) {
      return NextResponse.json({
        error: "This receipt image was already used on another order or top-up. Please upload the correct GCash proof for this transaction.",
      }, { status: 409 });
    }
    
    // 2. Name the file [orderId]_[email].[ext] to instantly identify who is paying in the storage bucket
    const fileName = buildReceiptFileName(orderId, receiptHash, email, fileExt);

    let uploadData: { path?: string; fullPath?: string } | null = null;
    let receiptUrl = "";

    try {
      const { data, error } = await supabase.storage
        .from('receipts')
        .upload(fileName, file, {
          upsert: true
        });

      if (error) throw error;

      uploadData = data;
      const { data: publicUrlData } = supabase.storage
        .from("receipts")
        .getPublicUrl(fileName);
      receiptUrl = publicUrlData.publicUrl;
    } catch (storageError) {
      console.warn("Receipt storage upload failed; falling back to inline receipt data:", storageError);
      receiptUrl = await fileToDataUrl(file);
      uploadData = { path: `inline:${orderId}` };
    }

    await updateOrderReceipt(supabase, orderId, receiptUrl, receiptHash);
    after(async () => {
      await syncBackupAdminClients(async (backupClient) => {
        return backupClient
          .from("orders")
          .update({ receipt_url: receiptUrl, receipt_hash: receiptHash })
          .eq("id", orderId);
      }, "order receipt sync");
    });

    if (orderData?.payment_method !== "Wallet") {
      const serviceTitle = Array.isArray((orderData as any)?.services)
        ? (orderData as any).services[0]?.title
        : (orderData as any)?.services?.title;

      const resolvedServiceTitle = await resolveSmmServiceTitle(orderData.smm_service_id, serviceTitle || "SMM Service");

      sendOrderApprovalNotification({
        orderId,
        trackingId: `BS-${orderId.slice(0, 8).toUpperCase()}`,
        service: resolvedServiceTitle,
        email,
        quantity: Number(orderData?.quantity || 0),
        amount: Number(orderData?.amount || 0),
        paymentMethod: orderData?.payment_method || "GCash",
        receiptUrl,
        details: orderData?.target_url || undefined,
      }).catch((telegramErr) => {
        console.error("Telegram order approval notification failed (non-blocking):", telegramErr);
      });
    }

    notifyCustomer({
      client: supabase,
      email,
      message: `System update: Receipt uploaded for order BS-${orderId.slice(0, 8).toUpperCase()}. Admin will verify it shortly.`,
    }).catch((notificationErr) => {
      console.error("Receipt upload customer notification failed:", notificationErr);
    });

    return NextResponse.json({ success: true, data: uploadData, email, receiptUrl });
  } catch (err: any) {
    console.error("Upload endpoint failed:", err);
    return NextResponse.json({ error: err?.message || (typeof err === "object" ? JSON.stringify(err) : String(err)) }, { status: 500 });
  }
}
