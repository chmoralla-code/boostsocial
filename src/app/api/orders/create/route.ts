import { NextRequest, NextResponse } from "next/server";
import { dualWrite } from "@/utils/supabase/dual-db";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { enforceRateLimit } from "@/utils/security/rate-limit";
import { calculateVipDiscount, getVipDiscountSummary } from "@/utils/vip";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseServiceRoleKey, getSupabaseUrl } from "@/utils/env";

const MAX_TARGET_LENGTH = 7000;

const clean = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);
const looksLikeMissingVipSchema = (error: unknown) => {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes("vip_") || message.includes("original_amount") || message.includes("schema cache");
};

export async function POST(req: NextRequest) {
  try {
    const rateLimitResponse = enforceRateLimit(req, {
      key: "orders-create",
      maxRequests: 20,
      windowMs: 60_000,
    });
    if (rateLimitResponse) return rateLimitResponse;

    const sessionClient = await createServerClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();
    if (!user?.email) {
      return NextResponse.json({ error: "Please sign in first before placing an order." }, { status: 401 });
    }

    const body = await req.json();

    const serviceId = clean(body.serviceId);
    const email = clean(body.email).toLowerCase();
    const targetUrl = clean(body.targetUrl);
    const paymentMethod = clean(body.paymentMethod) || "GCash";
    const quantity = Number(body.quantity);
    const amount = Number(body.amount);
    const smmServiceId = body.smmServiceId === undefined || body.smmServiceId === null
      ? null
      : clean(body.smmServiceId);

    if (!serviceId || !email || !targetUrl) {
      return NextResponse.json({ error: "Missing service, email, or target details." }, { status: 400 });
    }

    if (email !== user.email.trim().toLowerCase()) {
      return NextResponse.json({ error: "Order email does not match your account." }, { status: 403 });
    }

    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isInteger(quantity)) {
      return NextResponse.json({ error: "Invalid order quantity." }, { status: 400 });
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Invalid order amount." }, { status: 400 });
    }

    if (targetUrl.length > MAX_TARGET_LENGTH) {
      return NextResponse.json({ error: "Order details are too long." }, { status: 400 });
    }

    const orderId = crypto.randomUUID();
    const supabaseUrl = getSupabaseUrl();
    const serviceRoleKey = getSupabaseServiceRoleKey();

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: profileData } = await adminClient
      .from("profiles")
      .select("vip_plan, vip_expires_at")
      .eq("id", user.id)
      .single();

    const vipAmount = calculateVipDiscount(profileData || null, amount);
    const finalAmount = Math.max(vipAmount, 5);
    const adjustedSummary = getVipDiscountSummary(profileData || null, amount);

    const basePayload = {
      id: orderId,
      service_id: serviceId,
      customer_email: email,
      target_url: targetUrl,
      amount: finalAmount,
      status: "Pending",
      payment_method: paymentMethod,
      quantity,
      smm_service_id: smmServiceId || null,
    };

    const vipPayload = {
      ...basePayload,
      original_amount: amount,
      vip_plan: adjustedSummary.plan ? adjustedSummary.plan.id : null,
      vip_discount_percent: adjustedSummary.discountPercent,
      vip_discount_amount: adjustedSummary.savingsAmount,
    };

    let { error, databaseUsed } = await dualWrite(async (dbClient) => {
      return dbClient
        .from("orders")
        .insert([vipPayload])
        .select("id")
        .single();
    });

    if (error && looksLikeMissingVipSchema(error)) {
      const fallback = await dualWrite(async (dbClient) => {
        return dbClient
          .from("orders")
          .insert([basePayload])
          .select("id")
          .single();
      });
      error = fallback.error;
      databaseUsed = fallback.databaseUsed;
    }

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      orderId,
      data: { id: orderId },
      databaseUsed,
    });
  } catch (err: unknown) {
    console.error("Create order endpoint failed:", err);
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
