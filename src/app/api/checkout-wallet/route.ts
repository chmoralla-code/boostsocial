import { after, NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendOrderNotification } from "@/lib/telegram";
import { autoPlaceRixeyOrder } from "@/lib/rixeysmm";
import { syncBackupAdminClients, ensureOrdersSchema, hasServiceTitleColumn } from "@/utils/supabase/dual-db";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { enforceRateLimit } from "@/utils/security/rate-limit";
import { creditReferralCommission } from "@/utils/referrals";
import { getSupabaseServiceRoleKey, getSupabaseUrl } from "@/utils/env";
import { getVipDiscountSummary } from "@/utils/vip";
import { resolveOrderPricing } from "@/lib/orderPricing";

type WalletProfile = {
  balance?: number | string | null;
  vip_plan?: string | null;
  vip_expires_at?: string | null;
};

type CheckoutOrder = {
  id: string;
};

type WalletCheckoutRpcRow = {
  order_id: string;
  new_balance: number | string;
};

type OrderVipFields = {
  original_amount?: number;
  vip_plan?: string | null;
  vip_discount_percent?: number;
  vip_discount_amount?: number;
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) return String((error as Record<string, unknown>).message || error);
  return String(error);
};
const looksLikeMissingVipSchema = (error: unknown) => {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes("vip_") || message.includes("original_amount") || message.includes("schema cache");
};

export async function POST(req: NextRequest) {
  try {
    const rateLimitResponse = enforceRateLimit(req, {
      key: "checkout-wallet",
      maxRequests: 20,
      windowMs: 60_000,
    });
    if (rateLimitResponse) return rateLimitResponse;

    const sessionClient = await createServerClient();
    const {
      data: { user: sessionUser },
    } = await sessionClient.auth.getUser();
    if (!sessionUser?.id || !sessionUser.email) {
      return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
    }

    const {
      existingOrderId,
      userId,
      serviceId,
      email,
      url,
      quantity,
      smmServiceId
    } = await req.json();

    if (!userId || !serviceId || !email || !url || !quantity) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (userId !== sessionUser.id || String(email).trim().toLowerCase() !== sessionUser.email.trim().toLowerCase()) {
      return NextResponse.json({ error: "Wallet identity mismatch." }, { status: 403 });
    }

    const supabaseUrl = getSupabaseUrl();
    const serviceRoleKey = getSupabaseServiceRoleKey();

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    if (existingOrderId) {
      const { data: pendingOrder, error: pendingOrderError } = await supabase
        .from("orders")
        .select("id, customer_email, payment_method, status")
        .eq("id", existingOrderId)
        .single();

      if (pendingOrderError || !pendingOrder) {
        return NextResponse.json({ error: "Pending order was not found" }, { status: 404 });
      }

      if (String(pendingOrder.customer_email || "").trim().toLowerCase() !== String(email).trim().toLowerCase()) {
        return NextResponse.json({ error: "Wallet order email does not match the pending order" }, { status: 403 });
      }

      if (pendingOrder.status !== "Pending") {
        return NextResponse.json({ error: "Only pending orders can be paid with wallet." }, { status: 400 });
      }
    }

    const profileWithVip = await supabase
      .from("profiles")
      .select("balance, vip_plan, vip_expires_at")
      .eq("id", userId)
      .single();
    let profile: WalletProfile | null = profileWithVip.data as WalletProfile | null;
    let profileError = profileWithVip.error;

    if (profileError && looksLikeMissingVipSchema(profileError)) {
      const fallbackProfile = await supabase
        .from("profiles")
        .select("balance")
        .eq("id", userId)
        .single();
      profile = fallbackProfile.data as WalletProfile | null;
      profileError = fallbackProfile.error;
    }

    if (profileError) throw profileError;
    if (!profile) {
      return NextResponse.json({ error: "Customer profile was not found" }, { status: 404 });
    }

    const pricing = await resolveOrderPricing({
      client: supabase,
      serviceId,
      quantity: Number(quantity),
      targetUrl: String(url).trim(),
      requestedSmmServiceId: smmServiceId,
    });

    const regularCost = pricing.regularAmount;
    const discountSummary = getVipDiscountSummary(profile || null, regularCost);
    const cost = discountSummary.finalAmount;
    const { error: vipColumnsError } = await supabase
      .from("orders")
      .select("original_amount, vip_plan, vip_discount_percent, vip_discount_amount")
      .limit(1);
    const orderVipFields: OrderVipFields = vipColumnsError
      ? {}
      : {
          original_amount: regularCost,
          vip_plan: discountSummary.plan ? discountSummary.plan.id : null,
          vip_discount_percent: discountSummary.discountPercent,
          vip_discount_amount: discountSummary.savingsAmount,
        };

    await ensureOrdersSchema();
    const serviceTitleAvailable = await hasServiceTitleColumn();

    const { data: walletRows, error: walletRpcError } = await supabase.rpc("create_wallet_order", {
      p_user_id: userId,
      p_existing_order_id: existingOrderId || null,
      p_service_id: pricing.serviceId,
      p_service_title: serviceTitleAvailable ? pricing.serviceTitle : null,
      p_customer_email: String(email).trim(),
      p_target_url: String(url).trim(),
      p_amount: cost,
      p_quantity: pricing.quantity,
      p_smm_service_id: pricing.smmServiceId,
      p_original_amount: orderVipFields.original_amount ?? regularCost,
      p_vip_plan: orderVipFields.vip_plan ?? null,
      p_vip_discount_percent: orderVipFields.vip_discount_percent ?? 0,
      p_vip_discount_amount: orderVipFields.vip_discount_amount ?? 0,
    });

    if (walletRpcError) {
      const message = getErrorMessage(walletRpcError);
      if (/column.*service_title.*does not exist/i.test(message)) {
        return NextResponse.json({
          error: "Database schema needs updating. Please run: ALTER TABLE orders ADD COLUMN IF NOT EXISTS service_title TEXT; in your Supabase SQL Editor, then try again.",
        }, { status: 500 });
      }
      const status = /insufficient|pending order|only pending|profile|not found/i.test(message) ? 400 : 500;
      return NextResponse.json({ error: message }, { status });
    }

    const walletResult = Array.isArray(walletRows)
      ? walletRows[0] as WalletCheckoutRpcRow | undefined
      : walletRows as WalletCheckoutRpcRow | undefined;
    const order: CheckoutOrder | null = walletResult?.order_id ? { id: walletResult.order_id } : null;
    const newBalance = Number(walletResult?.new_balance ?? 0);

    if (!order?.id) {
      return NextResponse.json({ error: "Wallet order was not created" }, { status: 500 });
    }

    after(async () => {
      const shouldAutoPlace = !/compiling/i.test(String(url));
      const tasks = [
        syncBackupAdminClients(async (backupClient) => {
          const profileUpdate = await backupClient
            .from("profiles")
            .update({ balance: newBalance })
            .eq("id", userId);

          if (profileUpdate.error) return profileUpdate;

          return backupClient
            .from("orders")
            .upsert({
              id: order.id,
              service_id: pricing.serviceId,
              ...(serviceTitleAvailable ? { service_title: pricing.serviceTitle } : {}),
              customer_email: String(email).trim(),
              target_url: String(url).trim(),
              amount: cost,
              status: "Processing",
              payment_method: "Wallet",
              quantity: pricing.quantity,
              smm_service_id: pricing.smmServiceId,
              ...orderVipFields,
            });
        }, "wallet checkout sync"),
        creditReferralCommission({
          primaryClient: supabase,
          customerId: userId,
          customerEmail: String(email).trim(),
          source: "order",
          amount: cost,
          referenceId: order.id,
        }),
        ...(shouldAutoPlace ? [autoPlaceRixeyOrder(order.id, pricing.serviceId, String(url).trim(), pricing.quantity)] : []),
        sendOrderNotification({
          trackingId: `BS-${order.id.slice(0, 8).toUpperCase()}`,
          service: pricing.serviceTitle,
          email: String(email).trim(),
          quantity: pricing.quantity,
          amount: cost,
          paymentMethod: "Wallet",
          details: String(url).trim(),
        }),
      ];

      const results = await Promise.allSettled(tasks);
      for (const result of results) {
        if (result.status === "rejected") {
          console.error("Wallet checkout after-response task failed:", result.reason);
        }
      }
    });

    return NextResponse.json({ success: true, orderId: order.id, newBalance });
  } catch (err: unknown) {
    console.error("Wallet checkout endpoint failed:", err);
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
