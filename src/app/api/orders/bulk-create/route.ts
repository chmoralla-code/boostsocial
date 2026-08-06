import { after, NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { enforceRateLimit } from "@/utils/security/rate-limit";
import { getSupabaseServiceRoleKey, getSupabaseUrl } from "@/utils/env";
import { dualWrite, ensureOrdersSchema, hasServiceTitleColumn, syncBackupAdminClients } from "@/utils/supabase/dual-db";
import { resolveOrderPricing } from "@/lib/orderPricing";
import { getVipDiscountSummary } from "@/utils/vip";
import { validatePromoCode, applyPromoToPrice, recordPromoRedemption } from "@/lib/promo";
import { recordOrderEvent } from "@/lib/orderEvents";
import { sendOrderPlacedEmail } from "@/lib/approvalEmails";
import { creditReferralCommission } from "@/utils/referrals";
import { autoPlaceRixeyOrder } from "@/lib/rixeysmm";
import { sendOrderNotification } from "@/lib/telegram";

const MAX_BULK_URLS = 50;
const MAX_TARGET_LENGTH = 7000;

function getErrorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Bulk order entry: place the same service+quantity for up to 50 target URLs
 * at once. Wallet payments go through the atomic RPC per order; GCash orders
 * are created as Pending (receipt upload per order as usual).
 */
export async function POST(req: NextRequest) {
  try {
    const rateLimitResponse = enforceRateLimit(req, {
      key: "orders-bulk-create",
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
    const serviceId = clean(body.serviceId);
    const email = clean(body.email).toLowerCase();
    const paymentMethod = clean(body.paymentMethod) || "wallet";
    const quantity = Number(body.quantity);
    const rawUrls = Array.isArray(body.urls) ? body.urls.map((u: unknown) => clean(u)).filter(Boolean) : [];
    const smmServiceId = body.smmServiceId === undefined || body.smmServiceId === null
      ? null
      : clean(body.smmServiceId);
    const catalogSnapshot = body.catalogSnapshot && typeof body.catalogSnapshot === "object"
      ? body.catalogSnapshot
      : null;
    const promoCode = body.promoCode === undefined || body.promoCode === null
      ? null
      : clean(body.promoCode);

    if (!serviceId || !email) {
      return NextResponse.json({ error: "Missing service or email" }, { status: 400 });
    }
    if (email !== user.email.trim().toLowerCase()) {
      return NextResponse.json({ error: "Order email does not match your account." }, { status: 403 });
    }
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isInteger(quantity)) {
      return NextResponse.json({ error: "Invalid order quantity." }, { status: 400 });
    }
    if (rawUrls.length === 0) {
      return NextResponse.json({ error: "Add at least one target link." }, { status: 400 });
    }
    if (rawUrls.length > MAX_BULK_URLS) {
      return NextResponse.json({ error: `Maximum ${MAX_BULK_URLS} links per bulk order.` }, { status: 400 });
    }
    for (const url of rawUrls) {
      if (url.length > MAX_TARGET_LENGTH) {
        return NextResponse.json({ error: "One of the target links is too long." }, { status: 400 });
      }
    }
    if (!/^(wallet|gcash)$/i.test(paymentMethod)) {
      return NextResponse.json({ error: "Invalid payment method." }, { status: 400 });
    }

    const supabase = createClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
      auth: { persistSession: false },
    });

    // Pricing resolves once for the batch (same service+quantity).
    const pricing = await resolveOrderPricing({
      client: supabase,
      serviceId,
      quantity,
      targetUrl: rawUrls[0],
      requestedSmmServiceId: smmServiceId,
      catalogSnapshot,
    });

    const profileRes = await supabase.from("profiles").select("balance, vip_plan, vip_expires_at").eq("id", user.id).single();
    const profileData = profileRes.data;
    const regularCost = pricing.regularAmount;
    const discountSummary = getVipDiscountSummary(profileData || null, regularCost);
    const vipFinal = discountSummary.finalAmount;

    let promoDiscount = 0;
    let validatedPromo = null;
    if (promoCode) {
      const promoResult = await validatePromoCode(supabase, promoCode, { amount: vipFinal, serviceId, category: pricing.serviceTitle });
      if (promoResult.error || !promoResult.promo) {
        return NextResponse.json({ error: promoResult.error || "Invalid promo code" }, { status: 400 });
      }
      validatedPromo = promoResult.promo;
      promoDiscount = applyPromoToPrice(vipFinal, promoResult.promo).discountAmount;
    }
    const perOrderCost = Number((vipFinal - promoDiscount).toFixed(2));
    const totalCost = Number((perOrderCost * rawUrls.length).toFixed(2));

    const isWallet = paymentMethod.toLowerCase() === "wallet";
    if (isWallet) {
      const balance = Number((profileData as { balance?: number | string | null } | null)?.balance ?? 0);
      if (balance < totalCost) {
        return NextResponse.json({
          error: "Insufficient wallet balance.",
          code: "INSUFFICIENT_BALANCE",
          balance,
          requiredAmount: totalCost,
          shortfall: Number((totalCost - balance).toFixed(2)),
        }, { status: 402 });
      }
    }

    await ensureOrdersSchema();
    const serviceTitleAvailable = await hasServiceTitleColumn();

    const orderIds: string[] = [];
    const results: Array<{ orderId: string; trackingId: string; targetUrl: string }> = [];

    for (const targetUrl of rawUrls) {
      const orderId = crypto.randomUUID();
      const basePayload = {
        id: orderId,
        service_id: pricing.serviceId,
        ...(serviceTitleAvailable ? { service_title: pricing.serviceTitle } : {}),
        customer_email: email,
        target_url: targetUrl,
        amount: perOrderCost,
        status: isWallet ? "Processing" : "Pending",
        payment_method: isWallet ? "Wallet" : "GCash",
        quantity: pricing.quantity,
        smm_service_id: pricing.smmServiceId,
        original_amount: regularCost,
        vip_plan: discountSummary.plan ? discountSummary.plan.id : null,
        vip_discount_percent: discountSummary.discountPercent,
        vip_discount_amount: discountSummary.savingsAmount,
        ...(validatedPromo ? { promo_code: validatedPromo.code, promo_discount_amount: promoDiscount } : {}),
      };

      let writeResult;
      if (isWallet) {
        // Atomic wallet debit + order create per order.
        const { data: walletRows, error: rpcError } = await supabase.rpc("create_wallet_order", {
          p_user_id: user.id,
          p_existing_order_id: null,
          p_service_id: pricing.serviceId,
          p_service_title: serviceTitleAvailable ? pricing.serviceTitle : null,
          p_customer_email: email,
          p_target_url: targetUrl,
          p_amount: perOrderCost,
          p_quantity: pricing.quantity,
          p_smm_service_id: pricing.smmServiceId,
          p_original_amount: regularCost,
          p_vip_plan: discountSummary.plan ? discountSummary.plan.id : null,
          p_vip_discount_percent: discountSummary.discountPercent,
          p_vip_discount_amount: discountSummary.savingsAmount,
        });
        if (rpcError) {
          const message = getErrorMessage(rpcError);
          if (/insufficient/i.test(message)) {
            return NextResponse.json({ error: "Insufficient wallet balance.", code: "INSUFFICIENT_BALANCE" }, { status: 402 });
          }
          throw rpcError;
        }
        const placedId = Array.isArray(walletRows) ? walletRows[0]?.order_id : walletRows?.order_id;
        if (!placedId) throw new Error("Bulk wallet order was not created");
        orderIds.push(placedId);
      } else {
        writeResult = await dualWrite(async (dbClient) => {
          return dbClient.from("orders").insert([basePayload]).select("id").single();
        }, { deferBackupSync: true });
        if (writeResult.error) throw writeResult.error;
        if (writeResult.deferredBackupSync) {
          after(async () => {
            try { await writeResult!.deferredBackupSync!(); } catch (err) { console.error("Bulk GCash backup sync failed:", err); }
          });
        }
        orderIds.push(orderId);
      }

      results.push({
        orderId,
        trackingId: `BS-${orderId.slice(0, 8).toUpperCase()}`,
        targetUrl,
      });
    }

    // After all orders: side effects per order.
    after(async () => {
      const tasks: Promise<unknown>[] = [];

      if (isWallet) {
        const { data: walletRow } = await supabase
          .from("profiles")
          .select("balance")
          .eq("id", user.id)
          .single();
        const newBalance = Number((walletRow as { balance?: number | string } | null)?.balance ?? 0);
        tasks.push(
          syncBackupAdminClients(async (backupClient) => {
            await backupClient.from("profiles").update({ balance: newBalance }).eq("id", user.id);
            for (const orderId of orderIds) {
              await backupClient.from("orders").upsert({
                id: orderId,
                service_id: pricing.serviceId,
                ...(serviceTitleAvailable ? { service_title: pricing.serviceTitle } : {}),
                customer_email: email,
                target_url: results.find((r) => r.orderId === orderId)?.targetUrl,
                amount: perOrderCost,
                status: "Processing",
                payment_method: "Wallet",
                quantity: pricing.quantity,
                smm_service_id: pricing.smmServiceId,
                original_amount: regularCost,
                vip_plan: discountSummary.plan ? discountSummary.plan.id : null,
                vip_discount_percent: discountSummary.discountPercent,
                vip_discount_amount: discountSummary.savingsAmount,
                ...(validatedPromo ? { promo_code: validatedPromo.code, promo_discount_amount: promoDiscount } : {}),
              });
            }
          }, "bulk wallet sync").catch((err) => {
            console.error("Bulk wallet backup sync failed:", err);
          })
        );
      }

      for (const orderId of orderIds) {
        tasks.push(
          recordOrderEvent({
            client: supabase,
            orderId,
            eventType: "created",
            toStatus: isWallet ? "Processing" : "Pending",
            detail: isWallet ? "Bulk order paid with wallet" : "Bulk order registered",
          }).catch((err) => {
            console.error("Bulk order event failed:", err);
          })
        );

        if (isWallet) {
          tasks.push(
            autoPlaceRixeyOrder(orderId, pricing.serviceId, results.find((r) => r.orderId === orderId)?.targetUrl || "", pricing.quantity).catch((err) => {
              console.error("Bulk auto-placement failed:", err);
            })
          );
        }

        tasks.push(
          sendOrderNotification({
            trackingId: `BS-${orderId.slice(0, 8).toUpperCase()}`,
            service: pricing.serviceTitle,
            email,
            quantity: pricing.quantity,
            amount: perOrderCost,
            paymentMethod: isWallet ? "Wallet" : "GCash",
            details: results.find((r) => r.orderId === orderId)?.targetUrl || "",
          }).catch((err) => {
            console.error("Bulk telegram notification failed:", err);
          })
        );

        tasks.push(
          sendOrderPlacedEmail({
            email,
            trackingId: `BS-${orderId.slice(0, 8).toUpperCase()}`,
            serviceTitle: pricing.serviceTitle,
            amount: perOrderCost,
            quantity: pricing.quantity,
            paymentMethod: isWallet ? "Wallet" : "GCash",
          }).catch((err) => {
            console.error("Bulk placed email failed:", err);
          })
        );
      }

      if (isWallet) {
        for (const orderId of orderIds) {
          tasks.push(
            creditReferralCommission({
              primaryClient: supabase,
              customerId: user.id,
              customerEmail: email,
              source: "order",
              amount: perOrderCost,
              referenceId: orderId,
            }).catch((err) => {
              console.error("Bulk referral commission failed:", err);
            })
          );
        }
      }

      if (validatedPromo) {
        for (const orderId of orderIds) {
          tasks.push(
            recordPromoRedemption(supabase, {
              code: validatedPromo.code,
              orderId,
              customerEmail: email,
              discountAmount: promoDiscount,
            }).catch((err) => {
              console.error("Bulk promo redemption failed:", err);
            })
          );
        }
      }

      const settled = await Promise.allSettled(tasks);
      for (const result of settled) {
        if (result.status === "rejected") {
          console.error("Bulk order after-response task failed:", result.reason);
        }
      }
    });

    return NextResponse.json({
      success: true,
      count: results.length,
      orders: results,
      amountPerOrder: perOrderCost,
      totalAmount: totalCost,
      paymentMethod: isWallet ? "Wallet" : "GCash",
      serviceTitle: pricing.serviceTitle,
    });
  } catch (err: unknown) {
    console.error("Bulk order endpoint failed:", err);
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
