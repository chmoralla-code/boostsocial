import type { SupabaseClient, User } from "@supabase/supabase-js";

const PER_PAGE = 1000;
// Bound the scan so a runaway loop can never exhaust the function's time budget.
// 200 pages * 1000 per page covers 200k users.
const MAX_PAGES = 200;

/**
 * Find an auth user by email using bounded pagination.
 *
 * `supabase.auth.admin.listUsers()` returns only the first page (default ~50
 * users), so a plain call silently fails to find anyone past page 1 once the
 * user base grows. This walks every page until the user is found or the list
 * is exhausted.
 */
export async function findAuthUserByEmail(
  supabase: SupabaseClient,
  email: string
): Promise<User | null> {
  const target = email.trim().toLowerCase();
  if (!target) return null;

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
