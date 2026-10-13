import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { getSupabaseServiceRoleKey, getSupabaseUrl } from "@/utils/env";

/**
 * Admin view of every reseller API key, with its order count and volume.
 *
 * Read-only. Admin-only, gated the same way as the other admin endpoints
 * (an @boostsocial.com account).
 */

async function checkAdminAuth() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email?.endsWith("@boostsocial.com")) {
    return false;
  }
  return true;
}

export async function GET() {
  try {
    if (!(await checkAdminAuth())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createClient(
      getSupabaseUrl(),
      getSupabaseServiceRoleKey(),
      { auth: { persistSession: false } }
    );

    const { data: keys, error: keysError } = await supabase
      .from("api_keys")
      .select(
        "id, user_id, label, key_prefix, is_active, daily_limit, monthly_limit, spent_day, spent_month, last_used_at, created_at, revoked_at"
      )
      .order("created_at", { ascending: false });

    if (keysError) {
      if (/relation|does not exist|schema cache/i.test(keysError.message || "")) {
        return NextResponse.json({ keys: [] });
      }
      throw keysError;
    }

    const rows = keys || [];
    if (rows.length === 0) {
      return NextResponse.json({ keys: [] });
    }

    // Order count + volume per key, for the panel's summary numbers.
    const { data: orders } = await supabase
      .from("orders")
      .select("api_key_id, amount")
      .not("api_key_id", "is", null);

    const statsByKey = new Map<string, { orders: number; volume: number }>();
    for (const order of orders || []) {
      const id = String(order.api_key_id);
      const current = statsByKey.get(id) || { orders: 0, volume: 0 };
      current.orders += 1;
      current.volume += Number(order.amount || 0);
      statsByKey.set(id, current);
    }

    // Owner emails, so the admin sees who a key belongs to.
    const userIds = Array.from(new Set(rows.map((row) => row.user_id)));
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email")
      .in("id", userIds);

    const emailById = new Map(
      (profiles || []).map((profile) => [String(profile.id), profile.email])
    );

    return NextResponse.json({
      keys: rows.map((row) => {
        const stats = statsByKey.get(row.id) || { orders: 0, volume: 0 };
        return {
          ...row,
          email: emailById.get(String(row.user_id)) || null,
          orders: stats.orders,
          volume: Number(stats.volume.toFixed(2)),
        };
      }),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Admin reseller keys failed:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
