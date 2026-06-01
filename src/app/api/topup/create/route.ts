import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendTopupNotification } from "@/lib/telegram";
import { syncBackupAdminClients } from "@/utils/supabase/dual-db";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { enforceRateLimit } from "@/utils/security/rate-limit";
import { buildReceiptFileName, findDuplicateReceipt, hashReceiptFile } from "@/lib/receiptGuard";
import { notifyCustomer } from "@/lib/customerNotifications";

const MAX_RECEIPT_FILE_BYTES = 8 * 1024 * 1024;
const ALLOWED_RECEIPT_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

export async function POST(req: NextRequest) {
  try {
    const rateLimitResponse = enforceRateLimit(req, {
      key: "topup-create",
      maxRequests: 8,
      windowMs: 10 * 60_000,
    });
    if (rateLimitResponse) return rateLimitResponse;

    const sessionClient = await createServerClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();
    if (!user?.id || !user.email) {
      return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const userId = formData.get("userId") as string | null;
    const email = formData.get("email") as string | null;
    const amount = formData.get("amount") as string | null;

    if (!file || !userId || !email || !amount) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (userId !== user.id || email.trim().toLowerCase() !== user.email.trim().toLowerCase()) {
      return NextResponse.json({ error: "Top-up identity mismatch." }, { status: 403 });
    }

    if (!ALLOWED_RECEIPT_TYPES.has(file.type.toLowerCase())) {
      return NextResponse.json({ error: "Invalid receipt file type." }, { status: 400 });
    }

    if (file.size <= 0 || file.size > MAX_RECEIPT_FILE_BYTES) {
      return NextResponse.json({ error: "Receipt file is too large. Maximum is 8MB." }, { status: 400 });
    }

    const priceNum = Number(amount);
    if (isNaN(priceNum) || priceNum <= 0) {
      return NextResponse.json({ error: "Invalid top-up amount" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Server configuration missing" }, { status: 500 });
    }

    // Initialize administrative client bypassing RLS policies
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    const receiptHash = await hashReceiptFile(file);
    const duplicateReceipt = await findDuplicateReceipt(supabase, receiptHash);
    if (duplicateReceipt) {
      return NextResponse.json({
        error: "This receipt image was already used before. Please upload a fresh GCash proof for this top-up.",
      }, { status: 409 });
    }

    // 1. Create a topup record
    const { data: topup, error: topupError } = await supabase
      .from("topups")
      .insert([{
        user_id: userId,
        email: email.trim(),
        amount: priceNum,
        status: "pending"
      }])
      .select()
      .single();

    if (topupError) {
      throw topupError;
    }

    // 2. Upload file to 'receipts' storage
    const fileExt = file.name.split(".").pop() || "png";
    const fileName = buildReceiptFileName(`topup_${topup.id}`, receiptHash, email.trim(), fileExt);

    const { error: uploadError } = await supabase.storage
      .from("receipts")
      .upload(fileName, file, {
        upsert: true
      });

    if (uploadError) {
      throw uploadError;
    }

    // 3. Get the public URL of the receipt image
    const { data: publicUrlData } = supabase.storage
      .from("receipts")
      .getPublicUrl(fileName);

    // 4. Update the topup record with the receipt public URL
    const { error: updateError } = await supabase
      .from("topups")
      .update({ receipt_url: publicUrlData.publicUrl })
      .eq("id", topup.id);

    if (updateError) {
      throw updateError;
    }

    await syncBackupAdminClients(async (backupClient) => {
      return backupClient
        .from("topups")
        .upsert({
          id: topup.id,
          user_id: userId,
          email: email.trim(),
          amount: priceNum,
          receipt_url: publicUrlData.publicUrl,
          status: "pending",
        });
    }, "top-up creation sync");

    // 5. Send Telegram notification with receipt photo and approve/reject buttons
    try {
      await sendTopupNotification({
        topupId: topup.id,
        email: email.trim(),
        amount: priceNum,
        receiptUrl: publicUrlData.publicUrl,
      });
    } catch (telegramErr) {
      console.error("Telegram top-up notification failed (non-blocking):", telegramErr);
    }

    notifyCustomer({
      client: supabase,
      email: email.trim(),
      message: `System update: Your PHP ${priceNum.toFixed(2)} wallet top-up receipt was uploaded. Admin verification is now pending.`,
    }).catch((notificationErr) => {
      console.error("Top-up customer notification failed:", notificationErr);
    });

    return NextResponse.json({ success: true, topupId: topup.id });
  } catch (err: any) {
    console.error("Top-up creation API failed:", err);
    return NextResponse.json({ error: err.message || err.toString() }, { status: 500 });
  }
}
