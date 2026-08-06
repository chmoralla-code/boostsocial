import { after, NextRequest, NextResponse } from "next/server";
import { dualWrite, ensureOrdersSchema, hasServiceTitleColumn } from "@/utils/supabase/dual-db";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { enforceRateLimit } from "@/utils/security/rate-limit";
import { getVipDiscountSummary } from "@/utils/vip";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseServiceRoleKey, getSupabaseUrl } from "@/utils/env";
import { resolveOrderPricing } from "@/lib/orderPricing";
import { validatePromoCode, applyPromoToPrice, recordPromoRedemption } from "@/lib/promo";
import { recordOrderEvent } from "@/lib/orderEvents";
import { sendOrderPlacedEmail } from "@/lib/approvalEmails";

const MAX_TARGET_LENGTH = 7000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const clean = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) return String((error as Record<string, unknown>).message || error);
  return String(error);
};
const looksLikeMissingVipSchema = (error: unknown) => {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes("vip_") || message.includes("original_amount") || message.includes("schema cache");
};
const looksLikeMissingServiceTitle = (error: unknown) => {
  const message = getErrorMessage(error).toLowerCase();
  return /column.*service_title.*does not exist/i.test(message);
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
    const smmServiceId = body.smmServiceId === undefined || body.smmServiceId === null
      ? null
      : clean(body.smmServiceId);
    const catalogSnapshot = body.catalogSnapshot && typeof body.catalogSnapshot === "object"
      ? body.catalogSnapshot
      : null;
    const promoCode = body.promoCode === undefined || body.promoCode === null
      ? null
      : clean(body.promoCode);

    if (!serviceId || !email || !targetUrl) {
      return NextResponse.json({ error: "Missing service, email, or target details." }, { status: 400 });
    }

    if (email !== user.email.trim().toLowerCase()) {
      return NextResponse.json({ error: "Order email does not match your account." }, { status: 403 });
    }

    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isInteger(quantity)) {
      return NextResponse.json({ error: "Invalid order quantity." }, { status: 400 });
    }

    if (paymentMethod.toLowerCase() === "wallet") {
      return NextResponse.json({ error: "Use the wallet checkout endpoint for wallet payments." }, { status: 400 });
    }

    if (targetUrl.length > MAX_TARGET_LENGTH) {
      return NextResponse.json({ error: "Order details are too long." }, { status: 400 });
    }

    // Accept a client-generated UUID so the UI can show the tracking ID immediately.
    const requestedOrderId = clean(body.orderId);
    const orderId = requestedOrderId && UUID_RE.test(requestedOrderId)
      ? requestedOrderId
      : crypto.randomUUID();
    const supabaseUrl = getSupabaseUrl();
    const serviceRoleKey = getSupabaseServiceRoleKey();

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const [pricing, profileResult] = await Promise.all([
      resolveOrderPricing({
        client: adminClient,
        serviceId,
        quantity,
        targetUrl,
        requestedSmmServiceId: smmServiceId,
        catalogSnapshot,
      }),
      adminClient
        .from("profiles")
        .select("vip_plan, vip_expires_at")
        .eq("id", user.id)
        .single(),
    ]);

    const profileData = profileResult.data;
    const regularAmount = pricing.regularAmount;
    const adjustedSummary = getVipDiscountSummary(profileData || null, regularAmount);
    const vipFinal = adjustedSummary.finalAmount;

    // Apply promo code on top of the VIP-discounted amount.
    let promoDiscount = 0;
    let validatedPromo = null;
    if (promoCode) {
      const promoResult = await validatePromoCode(adminClient, promoCode, {
        amount: vipFinal,
        serviceId,
        category: pricing.serviceTitle,
      });
      if (promoResult.error || !promoResult.promo) {
        return NextResponse.json({ error: promoResult.error || "Invalid promo code" }, { status: 400 });
      }
      validatedPromo = promoResult.promo;
      const applied = applyPromoToPrice(vipFinal, promoResult.promo);
      promoDiscount = applied.discountAmount;
    }

    const finalAmount = Number((vipFinal - promoDiscount).toFixed(2));

    await ensureOrdersSchema();
    const serviceTitleAvailable = await hasServiceTitleColumn();

    const basePayload = {
      id: orderId,
      service_id: pricing.serviceId,
      ...(serviceTitleAvailable ? { service_title: pricing.serviceTitle } : {}),
      customer_email: email,
      target_url: targetUrl,
      amount: finalAmount,
      status: "Pending",
      payment_method: paymentMethod,
      quantity: pricing.quantity,
      smm_service_id: pricing.smmServiceId,
      ...(validatedPromo ? { promo_code: validatedPromo.code, promo_discount_amount: promoDiscount } : {}),
    };

    const vipPayload = {
      ...basePayload,
      original_amount: regularAmount,
      vip_plan: adjustedSummary.plan ? adjustedSummary.plan.id : null,
      vip_discount_percent: adjustedSummary.discountPercent,
      vip_discount_amount: adjustedSummary.savingsAmount,
    };

    const writeOpts = { deferBackupSync: true as const };
    let writeResult = await dualWrite(async (dbClient) => {
      return dbClient
        .from("orders")
        .insert([vipPayload])
        .select("id")
        .single();
    }, writeOpts);

    let { error, databaseUsed, deferredBackupSync } = writeResult;

    if (error && looksLikeMissingVipSchema(error)) {
      writeResult = await dualWrite(async (dbClient) => {
        return dbClient
          .from("orders")
          .insert([basePayload])
          .select("id")
          .single();
      }, writeOpts);
      error = writeResult.error;
      databaseUsed = writeResult.databaseUsed;
      deferredBackupSync = writeResult.deferredBackupSync;
    }

    if (error && looksLikeMissingServiceTitle(error)) {
      const strippedBase = { ...basePayload } as Omit<typeof basePayload, "service_title">;
      delete (strippedBase as Record<string, unknown>).service_title;
      const strippedVipPayload = {
        ...strippedBase,
        original_amount: regularAmount,
        vip_plan: adjustedSummary.plan ? adjustedSummary.plan.id : null,
        vip_discount_percent: adjustedSummary.discountPercent,
        vip_discount_amount: adjustedSummary.savingsAmount,
      };
      writeResult = await dualWrite(async (dbClient) => {
        return dbClient
          .from("orders")
          .insert([strippedVipPayload])
          .select("id")
          .single();
      }, writeOpts);
      if (writeResult.error && looksLikeMissingVipSchema(writeResult.error)) {
        writeResult = await dualWrite(async (dbClient) => {
          return dbClient
            .from("orders")
            .insert([strippedBase])
            .select("id")
            .single();
        }, writeOpts);
      }
      error = writeResult.error;
      databaseUsed = writeResult.databaseUsed;
      deferredBackupSync = writeResult.deferredBackupSync;
    }

    if (error) {
      throw error;
    }

    if (deferredBackupSync) {
      after(async () => {
        try {
          await deferredBackupSync();
        } catch (syncErr) {
          console.error("Deferred order create backup sync failed:", syncErr);
        }
      });
    }

    // Fire-and-forget side effects: order timeline event, promo redemption, email receipt.
    after(async () => {
      const tasks: Promise<unknown>[] = [
        recordOrderEvent({
          client: adminClient,
          orderId,
          eventType: "created",
          toStatus: "Pending",
          detail: "Order registered",
        }).catch((eventErr) => {
          console.error("Order event create failed:", eventErr);
        }),
      ];

      if (validatedPromo) {
        tasks.push(
          recordPromoRedemption(adminClient, {
            code: validatedPromo.code,
            orderId,
            customerEmail: email,
            discountAmount: promoDiscount,
          }).catch((promoErr) => {
            console.error("Promo redemption failed:", promoErr);
          })
        );
      }

      tasks.push(
        sendOrderPlacedEmail({
          email,
          trackingId: `BS-${orderId.slice(0, 8).toUpperCase()}`,
          serviceTitle: pricing.serviceTitle,
          amount: finalAmount,
          quantity: pricing.quantity,
          paymentMethod,
        }).catch((emailErr) => {
          console.error("Order placed email failed:", emailErr);
        })
      );

      const results = await Promise.allSettled(tasks);
      for (const result of results) {
        if (result.status === "rejected") {
          console.error("Order create after-response task failed:", result.reason);
        }
      }
    });

    return NextResponse.json({
      success: true,
      orderId,
      data: { id: orderId },
      amount: finalAmount,
      regularAmount,
      quantity: pricing.quantity,
      serviceTitle: pricing.serviceTitle,
      databaseUsed,
    });
  } catch (err: unknown) {
    console.error("Create order endpoint failed:", err);
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
