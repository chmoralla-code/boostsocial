import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { enforceRateLimit } from "@/utils/security/rate-limit";
import { getSupabaseServiceRoleKey, getSupabaseUrl } from "@/utils/env";
import { validatePromoCode, applyPromoToPrice } from "@/lib/promo";

function getErrorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

export async function POST(req: NextRequest) {
  try {
    const rateLimitResponse = enforceRateLimit(req, {
      key: "promo-validate",
      maxRequests: 30,
      windowMs: 60_000,
    });
    if (rateLimitResponse) return rateLimitResponse;

    const body = await req.json();
    const code = body.code;
    const amount = Number(body.amount);
    const serviceId = body.serviceId ? String(body.serviceId) : undefined;
    const category = body.category ? String(body.category) : undefined;

    if (!code || !Number.isFinite(amount) || amount < 0) {
      return NextResponse.json({ error: "Missing code or amount" }, { status: 400 });
    }

    const supabase = createClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
      auth: { persistSession: false },
    });

    const { promo, error } = await validatePromoCode(supabase, code, { amount, serviceId, category });
    if (error || !promo) {
      return NextResponse.json({ valid: false, error: error || "Invalid promo code" });
    }

    const { finalAmount, discountAmount } = applyPromoToPrice(amount, promo);
    return NextResponse.json({
      valid: true,
      code: promo.code,
      discountPercent: promo.discountPercent,
      discountAmount,
      finalAmount,
    });
  } catch (err: unknown) {
    console.error("Promo validate error:", err);
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
