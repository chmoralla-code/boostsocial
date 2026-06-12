import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendTopupNotification } from "@/lib/telegram";
import { syncBackupAdminClients } from "@/utils/supabase/dual-db";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { enforceRateLimit } from "@/utils/security/rate-limit";
import { hashReceiptFile } from "@/lib/receiptGuard";
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

    // Check for duplicate receipt using DB hash
    const receiptHash = await hashReceiptFile(file);
    const { data: existingTopup } = await supabase
      .from("topups")
      .select("id")
      .eq("receipt_hash", receiptHash)
      .limit(1);
    if (existingTopup && existingTopup.length > 0) {
      return NextResponse.json({
        error: "This receipt image was already used before. Please upload a fresh GCash proof for this top-up.",
      }, { status: 409 });
    }

    // Convert file to base64 data URL
    const fileBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(fileBuffer).toString("base64");
    const dataUrl = `data:${file.type};base64,${base64}`;

    // 1. Create a topup record with receipt data embedded
    const { data: topup, error: topupError } = await supabase
      .from("topups")
      .insert([{
        user_id: userId,
        email: email.trim(),
        amount: priceNum,
        receipt_url: dataUrl,
        receipt_data: dataUrl,
        receipt_hash: receiptHash,
        status: "pending"
      }])
      .select()
      .single();

    if (topupError) {
      throw topupError;
    }

    await syncBackupAdminClients(async (backupClient) => {
      return backupClient
        .from("topups")
        .upsert({
          id: topup.id,
          user_id: userId,
          email: email.trim(),
          amount: priceNum,
          receipt_url: dataUrl,
          receipt_data: dataUrl,
          receipt_hash: receiptHash,
          status: "pending",
        });
    }, "top-up creation sync");

    // 2. Send Telegram notification with receipt photo and approve/reject buttons
    try {
      await sendTopupNotification({
        topupId: topup.id,
        email: email.trim(),
        amount: priceNum,
        receiptUrl: dataUrl,
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
