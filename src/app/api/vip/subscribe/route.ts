import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { syncBackupAdminClients } from "@/utils/supabase/dual-db";
import { getSupabaseServiceRoleKey, getSupabaseUrl } from "@/utils/env";
import { getVipPlanById } from "@/utils/vip";
import { sendVipSubscriptionNotification } from "@/lib/telegram";
import { buildReceiptFileName, findDuplicateReceipt, hashReceiptFile } from "@/lib/receiptGuard";

const ALLOWED_VIP_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const MAX_RECEIPT_BYTES = 8 * 1024 * 1024;

type VipSubscribeBody = {
  planCode?: string;
  paymentMethod?: string;
  amount?: string | number;
  notes?: string;
};

function parseAmount(value: unknown): number | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return numeric;
}

function normalizeMethod(method: string | null | undefined) {
  const lower = String(method || "gcash").trim().toLowerCase();
  return lower === "wallet" ? "wallet" : "gcash";
}

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = getSupabaseUrl();
    const serviceRoleKey = getSupabaseServiceRoleKey();

    const sessionClient = await createServerClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();

    if (!user?.id || !user.email) {
      return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
    }

    const contentType = req.headers.get("content-type") || "";
    let planCode = "";
    let paymentMethod = "gcash";
    let notes = "";
    let amountOverride: number | null = null;
    let receiptFile: File | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      planCode = String(formData.get("planCode") || "").trim();
      paymentMethod = normalizeMethod(String(formData.get("paymentMethod") || ""));
      notes = String(formData.get("notes") || "").trim();
      amountOverride = parseAmount(formData.get("amount"));
      const uploadCandidate = formData.get("receipt") as File | null;
      receiptFile = uploadCandidate instanceof File ? uploadCandidate : null;
    } else {
      const body = (await req.json()) as VipSubscribeBody;
      planCode = String(body?.planCode || "").trim();
      paymentMethod = normalizeMethod(body?.paymentMethod);
      notes = String(body?.notes || "").trim();
      amountOverride = parseAmount(body?.amount);
    }

    if (!planCode) {
      return NextResponse.json({ error: "Please choose a VIP plan." }, { status: 400 });
    }

    const selectedPlan = getVipPlanById(planCode);
    if (!selectedPlan) {
      return NextResponse.json({ error: "Invalid VIP plan selected." }, { status: 400 });
    }

    const requestedAmount = amountOverride ?? selectedPlan.price;
    if (!requestedAmount) {
      return NextResponse.json({ error: "Invalid VIP amount." }, { status: 400 });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("vip_plan, vip_expires_at, balance, email")
      .eq("id", user.id)
      .single();

    if (profileError) throw profileError;

    if (paymentMethod === "wallet") {
      const currentBalance = Number(profile?.balance || 0);
      if (currentBalance < requestedAmount) {
        return NextResponse.json(
          {
            error: `Wallet balance is insufficient. Required PHP ${requestedAmount.toFixed(2)}, current balance PHP ${currentBalance.toFixed(2)}.`
          },
          { status: 400 }
        );
      }

      const now = new Date();
      const remainingStart = profile?.vip_expires_at
        ? Math.max(now.getTime(), new Date(profile.vip_expires_at).getTime())
        : now.getTime();
      const safeDate = new Date(remainingStart);
      safeDate.setDate(safeDate.getDate() + selectedPlan.durationDays);

      const newBalance = currentBalance - requestedAmount;

      const subscription = await adminClient
        .from("vip_subscriptions")
        .insert({
          user_id: user.id,
          email: user.email,
          plan_code: selectedPlan.id,
          payment_method: "Wallet",
          amount: requestedAmount,
          status: "approved",
          notes: notes || "Activated instantly via wallet balance",
          reviewed_at: new Date().toISOString(),
          reviewed_by: "system"
        })
        .select("id")
        .single();

      if (subscription.error) throw subscription.error;

      const { error: profileUpdateError } = await adminClient
        .from("profiles")
        .update({
          balance: newBalance,
          vip_plan: selectedPlan.id,
          vip_started_at: now.toISOString(),
          vip_expires_at: safeDate.toISOString(),
        })
        .eq("id", user.id);
      if (profileUpdateError) throw profileUpdateError;

      await syncBackupAdminClients(async (backupClient) => {
        await backupClient
          .from("vip_subscriptions")
          .insert({
            id: subscription.data?.id,
            user_id: user.id,
            email: user.email,
            plan_code: selectedPlan.id,
            payment_method: "Wallet",
            amount: requestedAmount,
            status: "approved",
            reviewed_at: new Date().toISOString(),
            reviewed_by: "system",
            notes: notes || "Activated instantly via wallet balance",
          });

        await backupClient
          .from("profiles")
          .update({
            balance: newBalance,
            vip_plan: selectedPlan.id,
            vip_started_at: now.toISOString(),
            vip_expires_at: safeDate.toISOString(),
          })
          .eq("id", user.id);
      }, "wallet vip subscription sync");

      return NextResponse.json({
        success: true,
        status: "approved",
        vipPlan: selectedPlan,
        subscriptionId: subscription.data?.id,
        newBalance,
      });
    }

    // GCash workflow: requires proof of payment
    if (!receiptFile) {
      return NextResponse.json({ error: "Please upload a GCash payment receipt." }, { status: 400 });
    }

    if (!ALLOWED_VIP_TYPES.has(receiptFile.type.toLowerCase())) {
      return NextResponse.json({ error: "Only JPEG, JPG, PNG, or WEBP receipts are accepted." }, { status: 400 });
    }

    if (receiptFile.size <= 0 || receiptFile.size > MAX_RECEIPT_BYTES) {
      return NextResponse.json({ error: "Receipt image is invalid or too large. Maximum is 8MB." }, { status: 400 });
    }

    const safePlanSlug = String(selectedPlan.id).replace(/[^a-z0-9_]/gi, "_").toLowerCase();
    const fileExt = receiptFile.name.split(".").pop() || "png";
    const receiptHash = await hashReceiptFile(receiptFile);
    const duplicateReceipt = await findDuplicateReceipt(adminClient, receiptHash);

    if (duplicateReceipt) {
      return NextResponse.json({
        error: "This receipt image was already used on another transaction. Please upload the correct GCash proof for this VIP subscription.",
      }, { status: 409 });
    }

    const storageName = buildReceiptFileName(`vip_${user.id}_${safePlanSlug}`, receiptHash, user.email, fileExt);

    const { error: receiptUploadError } = await adminClient.storage
      .from("receipts")
      .upload(storageName, receiptFile, { upsert: false });
    if (receiptUploadError) throw receiptUploadError;

    const { data: publicUrlData } = adminClient.storage
      .from("receipts")
      .getPublicUrl(storageName);
    const receiptUrl = publicUrlData.publicUrl;

    const subscription = await adminClient
      .from("vip_subscriptions")
      .insert({
        user_id: user.id,
        email: user.email,
        plan_code: selectedPlan.id,
        payment_method: "GCash",
        amount: requestedAmount,
        receipt_url: receiptUrl,
        notes: notes || null,
        status: "pending",
      })
      .select("id")
      .single();

    if (subscription.error) throw subscription.error;

    await syncBackupAdminClients(async (backupClient) => {
      await backupClient
        .from("vip_subscriptions")
        .insert({
          user_id: user.id,
          email: user.email,
          plan_code: selectedPlan.id,
          payment_method: "GCash",
          amount: requestedAmount,
          receipt_url: receiptUrl,
          status: "pending",
          notes: notes || null,
        });
    }, "vip subscription sync");

    sendVipSubscriptionNotification({
      subscriptionId: subscription.data?.id || "",
      email: user.email,
      plan: selectedPlan,
      amount: requestedAmount,
      receiptUrl,
    }).catch((err) => {
      console.error("VIP subscription telegram notify failed:", err);
    });

    return NextResponse.json({
      success: true,
      status: "pending",
      subscriptionId: subscription.data?.id,
      vipPlan: selectedPlan,
      message: "VIP subscription request is pending admin approval."
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown server error.";
    console.error("VIP subscribe failed:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
