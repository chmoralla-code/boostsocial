import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendOrderNotification } from "@/lib/telegram";
import { autoPlaceRixeyOrder } from "@/lib/rixeysmm";
import { syncBackupAdminClients } from "@/utils/supabase/dual-db";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { enforceRateLimit } from "@/utils/security/rate-limit";
import { creditReferralCommission } from "@/utils/referrals";
import { getVipDiscountSummary } from "@/utils/vip";

type WalletProfile = {
  balance?: number | string | null;
  vip_plan?: string | null;
  vip_expires_at?: string | null;
};

type CheckoutOrder = {
  id: string;
};

const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);
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
      totalPrice,
      serviceTitle,
      smmServiceId
    } = await req.json();

    if (!userId || !serviceId || !email || !url || !quantity || totalPrice === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (userId !== sessionUser.id || String(email).trim().toLowerCase() !== sessionUser.email.trim().toLowerCase()) {
      return NextResponse.json({ error: "Wallet identity mismatch." }, { status: 403 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Server configuration missing" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    if (existingOrderId) {
      const { data: pendingOrder, error: pendingOrderError } = await supabase
        .from("orders")
        .select("id, customer_email, payment_method")
        .eq("id", existingOrderId)
        .single();

      if (pendingOrderError || !pendingOrder) {
        return NextResponse.json({ error: "Pending order was not found" }, { status: 404 });
      }

      if (String(pendingOrder.customer_email || "").trim().toLowerCase() !== String(email).trim().toLowerCase()) {
        return NextResponse.json({ error: "Wallet order email does not match the pending order" }, { status: 403 });
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

    const currentBalance = Number(profile.balance || 0);
    const parsedTotal = Number(totalPrice);
    if (!Number.isFinite(parsedTotal) || parsedTotal <= 0) {
      return NextResponse.json({ error: "Invalid wallet checkout amount" }, { status: 400 });
    }

    const discountSummary = getVipDiscountSummary(profile || null, parsedTotal);
    const cost = Math.max(discountSummary.finalAmount, 5.00);
    const { error: vipColumnsError } = await supabase
      .from("orders")
      .select("original_amount, vip_plan, vip_discount_percent, vip_discount_amount")
      .limit(1);
    const orderVipFields = vipColumnsError
      ? {}
      : {
          original_amount: parsedTotal,
          vip_plan: discountSummary.plan ? discountSummary.plan.id : null,
          vip_discount_percent: discountSummary.discountPercent,
          vip_discount_amount: discountSummary.savingsAmount,
        };

    if (currentBalance < cost) {
      return NextResponse.json({ error: "Insufficient wallet balance" }, { status: 400 });
    }

    const newBalance = currentBalance - cost;
    const { error: updateProfileError } = await supabase
      .from("profiles")
      .update({ balance: newBalance })
      .eq("id", userId);

    if (updateProfileError) throw updateProfileError;

    let order: CheckoutOrder | null = null;
    if (existingOrderId) {
      const { data: updatedOrder, error: updateOrderError } = await supabase
        .from("orders")
        .update({
          service_id: serviceId,
          customer_email: String(email).trim(),
          target_url: String(url).trim(),
          amount: cost,
          status: "Processing",
          payment_method: "Wallet",
          quantity,
          smm_service_id: smmServiceId || null,
          ...orderVipFields,
        })
        .eq("id", existingOrderId)
        .select("id")
        .single();

      if (updateOrderError) throw updateOrderError;
      order = updatedOrder;
    } else {
      const { data: insertedOrder, error: insertOrderError } = await supabase
        .from("orders")
        .insert([
          {
            service_id: serviceId,
            customer_email: String(email).trim(),
            target_url: String(url).trim(),
            amount: cost,
            status: "Processing",
            payment_method: "Wallet",
            quantity,
            smm_service_id: smmServiceId || null,
            ...orderVipFields,
          }
        ])
        .select("id")
        .single();

      if (insertOrderError) throw insertOrderError;
      order = insertedOrder;
    }

    if (!order?.id) {
      return NextResponse.json({ error: "Wallet order was not created" }, { status: 500 });
    }

    await syncBackupAdminClients(async (backupClient) => {
      const profileUpdate = await backupClient
        .from("profiles")
        .update({ balance: newBalance })
        .eq("id", userId);

      if (profileUpdate.error) return profileUpdate;

      return backupClient
        .from("orders")
        .upsert({
          id: order.id,
          service_id: serviceId,
          customer_email: String(email).trim(),
          target_url: String(url).trim(),
          amount: cost,
          status: "Processing",
          payment_method: "Wallet",
          quantity,
          smm_service_id: smmServiceId || null,
          ...orderVipFields,
        });
    }, "wallet checkout sync");

    creditReferralCommission({
      primaryClient: supabase,
      customerId: userId,
      customerEmail: String(email).trim(),
      source: "order",
      amount: cost,
      referenceId: order.id,
    }).catch((err) => {
      console.error("Wallet referral order commission failed:", err);
    });

    autoPlaceRixeyOrder(order.id, serviceId, String(url).trim(), quantity).catch((err) => {
      console.error("Async auto-placement on RixeySMM from verified wallet checkout failed:", err);
    });

    sendOrderNotification({
      trackingId: `BS-${order.id.slice(0, 8).toUpperCase()}`,
      service: serviceTitle || serviceId,
      email: String(email).trim(),
      quantity,
      amount: cost,
      paymentMethod: "Wallet",
      details: String(url).trim(),
    });

    return NextResponse.json({ success: true, orderId: order.id, newBalance });
  } catch (err: unknown) {
    console.error("Wallet checkout endpoint failed:", err);
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
