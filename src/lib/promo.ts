import { SupabaseClient } from "@supabase/supabase-js";
import { syncBackupAdminClients } from "@/utils/supabase/dual-db";

export type PromoCodeRow = {
  id?: string;
  code: string;
  discount_percent?: number | string | null;
  discount_amount?: number | string | null;
  max_uses?: number | null;
  used_count?: number | null;
  min_order_amount?: number | string | null;
  applies_to?: string | null;
  expires_at?: string | null;
  active?: boolean | null;
  created_at?: string | null;
};

export type ValidatedPromo = {
  code: string;
  discountPercent: number;
  discountAmount: number;
  minOrderAmount: number;
};

type PromoValidationOptions = {
  /** Order subtotal BEFORE promo (after VIP discount). Used for min_order_amount + discount cap. */
  amount: number;
  /** Optional serviceId or category scope check. */
  serviceId?: string;
  category?: string;
};

export const PROMO_MAX_DISCOUNT_PERCENT = 100;
export const PROMO_MAX_FIXED_DISCOUNT = 50_000;

/** Normalize a promo code to canonical upper-case, alphanumeric + hyphen form. */
export function normalizePromoCode(value: unknown) {
  const code = String(value ?? "").trim().toUpperCase();
  if (!code || !/^[A-Z0-9-]{2,32}$/.test(code)) return null;
  return code;
}

/**
 * Validate a promo code against the DB + order context.
 * Returns the normalized promo (never touches redemption counts).
 */
export async function validatePromoCode(
  client: SupabaseClient,
  codeInput: unknown,
  options: PromoValidationOptions
): Promise<{ promo: ValidatedPromo | null; error?: string }> {
  const code = normalizePromoCode(codeInput);
  if (!code) return { promo: null, error: "Invalid promo code format" };

  let promo: PromoCodeRow | null = null;
  try {
    const { data } = await client
      .from("promo_codes")
      .select("*")
      .eq("code", code)
      .maybeSingle();
    promo = (data as PromoCodeRow | null) || null;
  } catch (err) {
    console.warn("Promo lookup failed:", err);
    return { promo: null, error: "Promo code is unavailable right now" };
  }

  if (!promo) return { promo: null, error: "Invalid promo code" };
  if (promo.active === false) return { promo: null, error: "Promo code is no longer active" };
  if (promo.expires_at && new Date(promo.expires_at).getTime() < Date.now()) {
    return { promo: null, error: "Promo code has expired" };
  }

  const used = Number(promo.used_count ?? 0);
  const maxUses = Number(promo.max_uses ?? 0);
  if (maxUses > 0 && used >= maxUses) {
    return { promo: null, error: "Promo code has reached its usage limit" };
  }

  const minOrder = Number(promo.min_order_amount ?? 0);
  if (minOrder > 0 && options.amount < minOrder) {
    return {
      promo: null,
      error: `This promo requires a minimum order of PHP ${minOrder.toFixed(2)}`,
    };
  }

  const scope = String(promo.applies_to ?? "all");
  if (scope !== "all") {
    if (scope.startsWith("service_id:")) {
      const targetId = scope.slice("service_id:".length).trim();
      if (options.serviceId && targetId !== options.serviceId) {
        return { promo: null, error: "Promo code does not apply to this service" };
      }
    } else if (scope.startsWith("category:")) {
      const targetCategory = scope.slice("category:".length).trim();
      if (options.category && targetCategory !== options.category) {
        return { promo: null, error: "Promo code does not apply to this category" };
      }
    }
  }

  const discountPercent = Math.min(Math.max(Number(promo.discount_percent ?? 0), 0), PROMO_MAX_DISCOUNT_PERCENT);
  const discountAmount = Math.min(Math.max(Number(promo.discount_amount ?? 0), 0), PROMO_MAX_FIXED_DISCOUNT);

  if (discountPercent <= 0 && discountAmount <= 0) {
    return { promo: null, error: "Promo code has no discount configured" };
  }

  return {
    promo: {
      code,
      discountPercent,
      discountAmount,
      minOrderAmount: minOrder,
    },
  };
}

/**
 * Compute the final price after applying a validated promo on top of the
 * VIP-discounted amount. Returns the discounted amount (floor 0) + the discount
 * value actually applied.
 */
export function applyPromoToPrice(amountAfterVip: number, promo: ValidatedPromo) {
  const base = Number(amountAfterVip) || 0;
  const percentDiscount = (base * promo.discountPercent) / 100;
  const discount = Math.min(
    percentDiscount + promo.discountAmount,
    base // never discount below zero
  );
  const final = Math.max(0, base - discount);
  return {
    finalAmount: Number(final.toFixed(2)),
    discountAmount: Number(discount.toFixed(2)),
  };
}

/**
 * Record a promo redemption on an order. Idempotent via UNIQUE(order_id):
 * a second call for the same order is a no-op. Also increments used_count with
 * a race-safe conditional update and mirrors to backups.
 */
export async function recordPromoRedemption(
  client: SupabaseClient,
  input: { code: string; orderId: string; customerEmail: string; discountAmount: number }
) {
  const { code, orderId, customerEmail, discountAmount } = input;
  const now = new Date().toISOString();

  const primary = await client
    .from("promo_redemptions")
    .insert({
      code,
      order_id: orderId,
      customer_email: customerEmail,
      discount_amount: discountAmount,
      created_at: now,
    })
    .select("id")
    .maybeSingle();

  // Duplicate redemption for this order — treat as success (idempotent).
  const isDuplicate = primary.error && /duplicate|unique|already exists/i.test(primary.error.message || "");
  if (primary.error && !isDuplicate) {
    throw primary.error;
  }

  // Increment usage count race-safely: only bumps when still under the cap.
  const { data: promo } = await client
    .from("promo_codes")
    .select("max_uses, used_count")
    .eq("code", code)
    .maybeSingle();

  const maxUses = Number((promo as PromoCodeRow | null)?.max_uses ?? 0);
  const usedCount = Number((promo as PromoCodeRow | null)?.used_count ?? 0);
  if (maxUses <= 0 || usedCount < maxUses) {
    await client
      .from("promo_codes")
      .update({ used_count: usedCount + 1 })
      .eq("code", code)
      .lte("used_count", maxUses > 0 ? maxUses - 1 : Number.MAX_SAFE_INTEGER);
  }

  await syncBackupAdminClients(async (backupClient) => {
    await backupClient
      .from("promo_redemptions")
      .upsert(
        {
          code,
          order_id: orderId,
          customer_email: customerEmail,
          discount_amount: discountAmount,
          created_at: now,
        },
        { onConflict: "order_id" }
      );
  }, "promo redemption sync");

  return { ok: true, duplicate: Boolean(isDuplicate) };
}
