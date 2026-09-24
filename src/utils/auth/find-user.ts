import type { SupabaseClient, User } from "@supabase/supabase-js";

const PER_PAGE = 100;
// Bound the scan so a runaway loop can never exhaust the function's time budget.
// 200 pages * 100 per page covers 20k users.
const MAX_PAGES = 200;

/**
 * Fast path: GoTrue's `filter` query (email substring match). Supported by
 * newer GoTrue versions; on older ones the param is ignored and the caller
 * still verifies an exact match, so a miss just falls through.
 */
async function findAuthUserByEmailFilter(
  supabaseUrl: string,
  serviceRoleKey: string,
  email: string
): Promise<User | null> {
  const url = new URL(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/admin/users`);
  url.searchParams.set("page", "1");
  url.searchParams.set("per_page", "50");
  url.searchParams.set("filter", email);

  const res = await fetch(url.toString(), {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    console.warn(`Auth user filter lookup returned HTTP ${res.status}; continuing with other lookups.`);
    return null;
  }

  const data = (await res.json()) as { users?: User[] };
  const users = data?.users ?? [];
  const target = email.toLowerCase();
  return users.find((u) => u.email && u.email.toLowerCase() === target) ?? null;
}

/**
 * Find an auth user by email.
 *
 * Lookup order (each step returns immediately on an exact match):
 *   1. profiles.email -> auth user id  (single indexed row, fastest + most reliable)
 *   2. GoTrue admin `filter` query     (exact match verified after)
 *   3. Bounded pagination of auth.users (safety net; scans until an empty page)
 *
 * A plain listUsers() only sees page 1, and older GoTrue versions ignore the
 * `filter` param, so the pagination step is required to bound worst cases.
 */
export async function findAuthUserByEmail(
  supabase: SupabaseClient,
  email: string
): Promise<User | null> {
  const target = email.trim().toLowerCase();
  if (!target) return null;

  // 1. profiles fast path (avoids scanning auth.users entirely).
  try {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", target)
      .limit(1)
      .maybeSingle();
    if (profileError) {
      console.warn("Profile email lookup error:", profileError.message);
    } else if (profile?.id) {
      const { data, error } = await supabase.auth.admin.getUserById(profile.id);
      if (!error && data?.user) return data.user;
    }
  } catch (err) {
    console.warn("Profile email lookup failed, falling back to filter/pagination:", err);
  }

  // 2. GoTrue admin filter query.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && serviceRoleKey) {
    try {
      const filtered = await findAuthUserByEmailFilter(supabaseUrl, serviceRoleKey, target);
      if (filtered) return filtered;
    } catch (err) {
      console.warn("Auth email filter lookup failed, falling back to pagination:", err);
    }
  }

  // 3. Bounded pagination. Scan until an empty page appears so an ignored
  //    per_page cap (which makes early pages shorter than PER_PAGE) can never
  //    stop the scan before the target user is reached.
  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: PER_PAGE,
    });
    if (error) throw error;

    const users = data?.users ?? [];
    if (users.length === 0) break;

    const match = users.find((u) => u.email && u.email.toLowerCase() === target);
    if (match) return match;
  }

  console.warn(`Auth user lookup found no account for ${target} after all strategies.`);
  return null;
}
