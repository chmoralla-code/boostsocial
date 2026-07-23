import type { SupabaseClient, User } from "@supabase/supabase-js";

const PER_PAGE = 1000;
// Bound the scan so a runaway loop can never exhaust the function's time budget.
// 200 pages * 1000 per page covers 200k users.
const MAX_PAGES = 200;

/**
 * Prefer GoTrue's `filter` query (email substring match) so we don't paginate
 * the entire auth.users table on every OTP / confirmation lookup.
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

  if (!res.ok) return null;

  const data = (await res.json()) as { users?: User[] };
  const users = data?.users ?? [];
  const target = email.toLowerCase();
  return users.find((u) => u.email && u.email.toLowerCase() === target) ?? null;
}

/**
 * Find an auth user by email.
 *
 * Tries GoTrue's admin `filter` param first (O(1)-ish), then falls back to
 * bounded pagination. `listUsers()` alone only sees page 1 by default, so a
 * plain call silently fails to find anyone past page 1 once the user base grows.
 */
export async function findAuthUserByEmail(
  supabase: SupabaseClient,
  email: string
): Promise<User | null> {
  const target = email.trim().toLowerCase();
  if (!target) return null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && serviceRoleKey) {
    try {
      const filtered = await findAuthUserByEmailFilter(
        supabaseUrl,
        serviceRoleKey,
        target
      );
      if (filtered) return filtered;
    } catch (err) {
      console.warn("Auth email filter lookup failed, falling back to profiles/pagination:", err);
    }
  }

  // Fast path: profiles.email → auth user id (avoids full auth.users scan).
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", target)
      .maybeSingle();
    if (profile?.id) {
      const { data, error } = await supabase.auth.admin.getUserById(profile.id);
      if (!error && data?.user) return data.user;
    }
  } catch (err) {
    console.warn("Profile email lookup failed, falling back to pagination:", err);
  }

  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: PER_PAGE,
    });
    if (error) throw error;

    const users = data?.users ?? [];
    const match = users.find(
      (u) => u.email && u.email.toLowerCase() === target
    );
    if (match) return match;

    if (users.length < PER_PAGE) break;
  }

  return null;
}
