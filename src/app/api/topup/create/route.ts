import { after, NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendTopupNotification } from "@/lib/telegram";
import { syncBackupAdminClients } from "@/utils/supabase/dual-db";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { enforceRateLimit } from "@/utils/security/rate-limit";
import { notifyCustomer } from "@/lib/customerNotifications";
import { hashReceiptFile } from "@/lib/receiptGuard";
import { autoVerifyAndApproveTopup } from "@/lib/receiptVerifier";
import { creditReferralCommission } from "@/utils/referrals";

const MAX_RECEIPT_FILE_BYTES = 8 * 1024 * 1024;
const ALLOWED_RECEIPT_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

async function findDuplicateReceiptRecord(supabase: any, receiptHash: string) {
  try {
    const [orders, topups, vipSubscriptions] = await Promise.all([
      supabase.from("orders").select("id").eq("receipt_hash", receiptHash).limit(1),
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
    console.warn("Top-up receipt hash duplicate lookup skipped:", error);
  }

  return null;
}

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
    const duplicateReceipt = await findDuplicateReceiptRecord(supabase, receiptHash);
    if (duplicateReceipt) {
      return NextResponse.json({
        error: "This receipt image was already used on another transaction. Please upload the correct GCash proof for this top-up.",
      }, { status: 409 });
    }

    // Convert file to base64 data URL
    const fileBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(fileBuffer).toString("base64");
    const dataUrl = `data:${file.type};base64,${base64}`;

    // 1. Create a topup record with receipt data embedded
    let { data: topup, error: topupError } = await supabase
      .from("topups")
      .insert([{
        user_id: userId,
        email: email.trim(),
        amount: priceNum,
        receipt_url: dataUrl,
        receipt_hash: receiptHash,
        status: "pending"
      }])
      .select()
      .single();

    if (topupError && /receipt_hash|schema cache/i.test(topupError.message || "")) {
      const fallback = await supabase
        .from("topups")
        .insert([{
          user_id: userId,
          email: email.trim(),
          amount: priceNum,
          receipt_url: dataUrl,
          status: "pending"
        }])
        .select()
        .single();
      topup = fallback.data;
      topupError = fallback.error;
    }

    if (topupError) {
      throw topupError;
    }

    // 2. Run AI receipt verification to auto-approve if amount matches
    let autoApproval: Record<string, any> | null = null;
    let finalStatus = "pending";

    try {
      autoApproval = await autoVerifyAndApproveTopup({
        supabase,
        topupId: topup.id,
        requestedAmount: priceNum,
        imageBuffer: Buffer.from(fileBuffer),
        mimeType: file.type,
        userEmail: email.trim(),
      });

      if (autoApproval.autoApproved) {
        finalStatus = "approved";
      }
    } catch (ocrErr) {
      console.error("AI receipt verification failed (graceful fallback):", ocrErr);
    }

    after(async () => {
      // Sync to backup databases
      await syncBackupAdminClients(async (backupClient) => {
        return backupClient
          .from("topups")
          .upsert({
            id: topup.id,
            user_id: userId,
            email: email.trim(),
            amount: priceNum,
            receipt_url: dataUrl,
            receipt_hash: receiptHash,
            status: finalStatus,
          });
      }, "top-up creation sync");

      if (autoApproval?.autoApproved) {
        // Credit referral commission for auto-approved topups
        try {
          await creditReferralCommission({
            primaryClient: supabase,
            customerId: userId,
            source: "topup",
            amount: priceNum,
            referenceId: topup.id,
          });
        } catch (commissionError) {
          console.error("Auto-approval referral commission failed:", commissionError);
        }
      }

      // Always send Telegram notification for manual review or audit
      try {
        await sendTopupNotification({
          topupId: topup.id,
          email: email.trim(),
          amount: priceNum,
          receiptUrl: dataUrl,
        });
      } catch (telegramErr) {
        console.error("Telegram top-up notification failed (after response):", telegramErr);
      }

      notifyCustomer({
        client: supabase,
        email: email.trim(),
        message: autoApproval?.autoApproved
          ? `System update: Your PHP ${priceNum.toFixed(2)} wallet top-up was AI-verified and instantly approved! New balance has been credited. 🚀`
          : `System update: Your PHP ${priceNum.toFixed(2)} wallet top-up receipt was uploaded and queued for admin verification. Please wait for manual approval.`,
      }).catch((notificationErr) => {
        console.error("Top-up customer notification failed:", notificationErr);
      });
    });

    return NextResponse.json({
      success: true,
      topupId: topup.id,
      autoApproved: autoApproval?.autoApproved ?? false,
      rejectedAsFake: autoApproval?.rejectedAsFake ?? false,
      rejectedAsDuplicate: autoApproval?.rejectedAsDuplicate ?? false,
      extractedAmount: autoApproval?.extractedAmount ?? null,
      aiConfidence: autoApproval?.confidence ?? null,
      aiReason: autoApproval?.reason ?? null,
    });
  } catch (err: any) {
    console.error("Top-up creation API failed:", err);
    return NextResponse.json({ error: err?.message || (typeof err === "object" ? JSON.stringify(err) : String(err)) }, { status: 500 });
  }
}
