import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { enforceRateLimit } from "@/utils/security/rate-limit";
import { getSupabaseServiceRoleKey, getSupabaseUrl } from "@/utils/env";
import { syncBackupAdminClients } from "@/utils/supabase/dual-db";
import { recordOrderEvent } from "@/lib/orderEvents";
import { resolveOrderPricing } from "@/lib/orderPricing";
import { getVipDiscountSummary } from "@/utils/vip";
import { creditReferralCommission } from "@/utils/referrals";
import { autoPlaceRixeyOrder } from "@/lib/rixeysmm";
import { sendOrderNotification } from "@/lib/telegram";

function getErrorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Refill: re-order the same target/quantity/service as an existing completed
 * order. Wallet-backed (instant, Processing) — reuses the atomic wallet RPC and
 * the auto-placer so the refill follows the exact same pipeline as a new order.
 */
export async function POST(req: NextRequest) {
  try {
    const rateLimitResponse = enforceRateLimit(req, {
      key: "orders-refill",
      maxRequests: 10,
      windowMs: 60_000,
    });
    if (rateLimitResponse) return rateLimitResponse;

    const sessionClient = await createServerClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();
    if (!user?.id || !user.email) {
      return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
    }

    const body = await req.json();
    const originalOrderId = String(body.orderId || "").trim();
    if (!originalOrderId) {
      return NextResponse.json({ error: "Missing order id" }, { status: 400 });
    }

    const supabase = createClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
      auth: { persistSession: false },
    });

    // 1. Load the original completed order + verify ownership.
    const { data: original, error: originalErr } = await supabase
      .from("orders")
      .select("id, customer_email, status, service_id, smm_service_id, target_url, quantity, amount, services(title)")
      .eq("id", originalOrderId)
      .maybeSingle();

    if (originalErr || !original) {
      return NextResponse.json({ error: "Order was not found" }, { status: 404 });
    }
    if (String(original.customer_email || "").trim().toLowerCase() !== user.email.trim().toLowerCase()) {
      return NextResponse.json({ error: "This order does not belong to your account" }, { status: 403 });
    }
    if (original.status !== "Completed") {
      return NextResponse.json({ error: "Only completed orders can be refilled" }, { status: 400 });
    }

    // 2. Recompute current pricing (same service/quantity). Refills bill at
    //    today's price so a price change can't undercharge.
    const pricing = await resolveOrderPricing({
      client: supabase,
      serviceId: String(original.service_id),
      quantity: Number(original.quantity),
      targetUrl: String(original.target_url || ""),
      requestedSmmServiceId: original.smm_service_id ? String(original.smm_service_id) : null,
    });
    const regularCost = pricing.regularAmount;
    const profileRes = await supabase.from("profiles").select("balance, vip_plan, vip_expires_at").eq("id", user.id).single();
    const discountSummary = getVipDiscountSummary(profileRes.data || null, regularCost);
    const cost = discountSummary.finalAmount;

    // 3. Check balance before touching the DB (the RPC re-checks atomically).
    const balance = Number((profileRes.data as { balance?: number | null } | null)?.balance ?? 0);
    if (balance < cost) {
      return NextResponse.json({
        error: "Insufficient wallet balance.",
        code: "INSUFFICIENT_BALANCE",
        balance,
        requiredAmount: cost,
        shortfall: Number((cost - balance).toFixed(2)),
      }, { status: 402 });
    }

    // 4. Guard: one active refill per original order (UNIQUE(original_order_id)).
    const { data: existingRefill } = await supabase
      .from("refill_orders")
      .select("id, status")
      .eq("original_order_id", originalOrderId)
      .maybeSingle();
    if (existingRefill) {
      return NextResponse.json({ error: "This order has already been refilled" }, { status: 409 });
    }

    // 5. Create the refill record, then place a fresh order via the atomic RPC.
    const { data: refillRow, error: refillErr } = await supabase
      .from("refill_orders")
      .insert({
        original_order_id: originalOrderId,
        customer_email: user.email.trim(),
        service_id: original.service_id,
        smm_service_id: original.smm_service_id,
        target_url: original.target_url,
        quantity: original.quantity,
        amount: cost,
        status: "pending",
      })
      .select("id")
      .single();

    if (refillErr) {
      if (/duplicate|unique/i.test(refillErr.message || "")) {
        return NextResponse.json({ error: "This order has already been refilled" }, { status: 409 });
      }
      throw refillErr;
    }

    const { data: walletRows, error: rpcError } = await supabase.rpc("create_wallet_order", {
      p_user_id: user.id,
      p_existing_order_id: null,
      p_service_id: pricing.serviceId,
      p_service_title: pricing.serviceTitle,
      p_customer_email: user.email.trim(),
      p_target_url: String(original.target_url || "").trim(),
      p_amount: cost,
      p_quantity: pricing.quantity,
      p_smm_service_id: pricing.smmServiceId,
      p_original_amount: regularCost,
      p_vip_plan: discountSummary.plan ? discountSummary.plan.id : null,
      p_vip_discount_percent: discountSummary.discountPercent,
      p_vip_discount_amount: discountSummary.savingsAmount,
    });

    if (rpcError) {
      // Roll back the refill marker so the customer can retry.
      await supabase.from("refill_orders").delete().eq("id", refillRow.id).maybeSingle();
      const message = getErrorMessage(rpcError);
      if (/insufficient/i.test(message)) {
        return NextResponse.json({ error: "Insufficient wallet balance.", code: "INSUFFICIENT_BALANCE", requiredAmount: cost }, { status: 402 });
      }
      throw rpcError;
    }

    const newOrderId = Array.isArray(walletRows) ? walletRows[0]?.order_id : walletRows?.order_id;
    if (!newOrderId) {
      await supabase.from("refill_orders").delete().eq("id", refillRow.id).maybeSingle();
      return NextResponse.json({ error: "Refill order was not created" }, { status: 500 });
    }

    const trackingId = `BS-${newOrderId.slice(0, 8).toUpperCase()}`;
    const shouldAutoPlace = !/compiling/i.test(String(original.target_url || ""));

    // 6. Fire-and-forget: backup sync, provider placement, referral, telegram, events.
    const customerEmail = user.email.trim();
    const newBalance = Array.isArray(walletRows) ? walletRows[0]?.new_balance : walletRows?.new_balance;
    const syncTask = syncBackupAdminClients(async (backupClient) => {
      await backupClient.from("profiles").update({ balance: newBalance }).eq("id", user.id);
      await backupClient.from("orders").upsert({
        id: newOrderId,
        service_id: pricing.serviceId,
        service_title: pricing.serviceTitle,
        customer_email: customerEmail,
        target_url: String(original.target_url || "").trim(),
        amount: cost,
        status: "Processing",
        payment_method: "Wallet",
        quantity: pricing.quantity,
        smm_service_id: pricing.smmServiceId,
        original_amount: regularCost,
        vip_plan: discountSummary.plan ? discountSummary.plan.id : null,
        vip_discount_percent: discountSummary.discountPercent,
        vip_discount_amount: discountSummary.savingsAmount,
      }, { onConflict: "id" });
      await backupClient.from("refill_orders").upsert({
        id: refillRow.id,
        original_order_id: originalOrderId,
        customer_email: customerEmail,
        service_id: original.service_id,
        smm_service_id: original.smm_service_id,
        target_url: original.target_url,
        quantity: original.quantity,
        amount: cost,
        status: "pending",
      }, { onConflict: "id" });
    }, "refill order sync");

    const tasks: Promise<unknown>[] = [
      syncTask.catch((syncErr) => {
        console.error("Refill backup sync failed:", syncErr);
      }),
      ...(shouldAutoPlace
        ? [
            autoPlaceRixeyOrder(newOrderId, pricing.serviceId, String(original.target_url || "").trim(), pricing.quantity).catch((placeErr) => {
              console.error("Refill auto-placement failed:", placeErr);
            }),
          ]
        : []),
      creditReferralCommission({
        primaryClient: supabase,
        customerId: user.id,
        customerEmail: user.email.trim(),
        source: "order",
        amount: cost,
        referenceId: newOrderId,
      }).catch((err) => {
        console.error("Refill referral commission failed:", err);
      }),
      sendOrderNotification({
        trackingId,
        service: pricing.serviceTitle,
        email: user.email.trim(),
        quantity: pricing.quantity,
        amount: cost,
        paymentMethod: "Wallet",
        details: String(original.target_url || "").trim(),
      }).catch((err) => {
        console.error("Refill telegram notification failed:", err);
      }),
      recordOrderEvent({
        client: supabase,
        orderId: newOrderId,
        eventType: "created",
        toStatus: "Processing",
        detail: "Refill order paid with wallet",
      }).catch((eventErr) => {
        console.error("Refill order event failed:", eventErr);
      }),
      recordOrderEvent({
        client: supabase,
        orderId: originalOrderId,
        eventType: "refill_requested",
        detail: "Customer requested a refill of this order",
      }).catch((eventErr) => {
        console.error("Refill request event failed:", eventErr);
      }),
    ];

    const results = await Promise.allSettled(tasks);
    for (const result of results) {
      if (result.status === "rejected") {
        console.error("Refill after-response task failed:", result.reason);
      }
    }

    return NextResponse.json({
      success: true,
      orderId: newOrderId,
      refillId: refillRow.id,
      trackingId,
      newBalance,
      amount: cost,
      quantity: pricing.quantity,
      serviceTitle: pricing.serviceTitle,
    });
  } catch (err: unknown) {
    console.error("Refill endpoint failed:", err);
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
