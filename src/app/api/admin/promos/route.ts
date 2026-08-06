import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { syncBackupAdminClients } from "@/utils/supabase/dual-db";
import { normalizePromoCode, PROMO_MAX_FIXED_DISCOUNT, PROMO_MAX_DISCOUNT_PERCENT } from "@/lib/promo";

function getErrorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

async function checkAdminAuth() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email?.endsWith("@boostsocial.com")) {
    return { authenticated: false, supabase: null };
  }

  return { authenticated: true, supabase };
}

type PromoInput = {
  id?: string;
  code?: string;
  discount_percent?: number | string | null;
  discount_amount?: number | string | null;
  max_uses?: number | string | null;
  min_order_amount?: number | string | null;
  applies_to?: string | null;
  expires_at?: string | null;
  active?: boolean | null;
  action?: "create" | "update" | "toggle" | "delete";
};

type NormalizedPromo = {
  code: string | null;
  discount_percent: number;
  discount_amount: number;
  max_uses: number;
  used_count: number;
  min_order_amount: number;
  applies_to: string;
  expires_at: string | null;
  active: boolean;
};

function normalizePromoInput(body: PromoInput): { error: string; promo?: undefined } | { error?: undefined; promo: NormalizedPromo } {
  const code = normalizePromoCode(body.code);
  if (!code && body.action !== "toggle" && body.action !== "delete") {
    return { error: "Promo code must be 2–32 letters, numbers, or hyphens" };
  }

  const discountPercent = Math.min(Math.max(Number(body.discount_percent ?? 0), 0), PROMO_MAX_DISCOUNT_PERCENT);
  const discountAmount = Math.min(Math.max(Number(body.discount_amount ?? 0), 0), PROMO_MAX_FIXED_DISCOUNT);
  const maxUses = Math.max(Math.floor(Number(body.max_uses ?? 1)), 1);
  const minOrderAmount = Math.max(Number(body.min_order_amount ?? 0), 0);
  const appliesTo = String(body.applies_to ?? "all").trim() || "all";

  if (discountPercent <= 0 && discountAmount <= 0) {
    return { error: "Set a percent discount or a fixed amount discount" };
  }

  return {
    promo: {
      code,
      discount_percent: discountPercent,
      discount_amount: discountAmount,
      max_uses: maxUses,
      used_count: 0,
      min_order_amount: minOrderAmount,
      applies_to: appliesTo,
      expires_at: body.expires_at ? new Date(body.expires_at).toISOString() : null,
      active: body.active === undefined ? true : Boolean(body.active),
    },
  };
}

export async function GET() {
  try {
    const { authenticated, supabase } = await checkAdminAuth();
    if (!authenticated || !supabase) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("promo_codes")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ promos: data || [] });
  } catch (err: unknown) {
    console.error("GET promos error:", err);
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { authenticated, supabase } = await checkAdminAuth();
    if (!authenticated || !supabase) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as PromoInput;
    const action = body.action || "create";

    if (action === "delete") {
      if (!body.id) {
        return NextResponse.json({ error: "Missing promo id" }, { status: 400 });
      }
      await supabase.from("promo_codes").delete().eq("id", body.id);
      await syncBackupAdminClients(async (backupClient) => {
        await backupClient.from("promo_codes").delete().eq("id", body.id);
      }, "promo delete sync");
      return NextResponse.json({ success: true });
    }

    if (action === "toggle") {
      if (!body.id) {
        return NextResponse.json({ error: "Missing promo id" }, { status: 400 });
      }
      const { data: current } = await supabase
        .from("promo_codes")
        .select("active")
        .eq("id", body.id)
        .maybeSingle();
      const nextActive = current?.active === false;
      await supabase.from("promo_codes").update({ active: nextActive }).eq("id", body.id);
      await syncBackupAdminClients(async (backupClient) => {
        await backupClient.from("promo_codes").update({ active: nextActive }).eq("id", body.id);
      }, "promo toggle sync");
      return NextResponse.json({ success: true, active: nextActive });
    }

    if (action === "update") {
      if (!body.id) {
        return NextResponse.json({ error: "Missing promo id" }, { status: 400 });
      }
      const normalized = normalizePromoInput(body);
      if (!normalized.promo) {
        return NextResponse.json({ error: normalized.error || "Invalid promo code" }, { status: 400 });
      }
      const patch = {
        ...(body.code !== undefined ? { code: normalized.promo.code } : {}),
        discount_percent: normalized.promo.discount_percent,
        discount_amount: normalized.promo.discount_amount,
        max_uses: normalized.promo.max_uses,
        min_order_amount: normalized.promo.min_order_amount,
        applies_to: normalized.promo.applies_to,
        expires_at: normalized.promo.expires_at,
        active: normalized.promo.active,
      };
      await supabase.from("promo_codes").update(patch).eq("id", body.id);
      await syncBackupAdminClients(async (backupClient) => {
        await backupClient.from("promo_codes").update(patch).eq("id", body.id);
      }, "promo update sync");
      return NextResponse.json({ success: true });
    }

    // create
    const normalized = normalizePromoInput(body);
    if (!normalized.promo) {
      return NextResponse.json({ error: normalized.error || "Invalid promo code" }, { status: 400 });
    }
    const { data: inserted, error } = await supabase
      .from("promo_codes")
      .insert(normalized.promo)
      .select("*")
      .single();

    if (error) {
      if (/duplicate|unique/i.test(error.message || "")) {
        return NextResponse.json({ error: "That promo code already exists" }, { status: 409 });
      }
      throw error;
    }

    await syncBackupAdminClients(async (backupClient) => {
      await backupClient.from("promo_codes").insert(normalized.promo);
    }, "promo create sync");

    return NextResponse.json({ success: true, promo: inserted });
  } catch (err: unknown) {
    console.error("POST promos error:", err);
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
