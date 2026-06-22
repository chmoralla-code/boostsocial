import { createClient } from "@supabase/supabase-js";
import { getSupabaseServiceRoleKey, getSupabaseUrl } from "@/utils/env";

let cachedMultiplier: number | null = null;
let lastFetch = 0;
const CACHE_TTL = 30_000; // 30 seconds

const DEFAULT_MULTIPLIER = 3.0;

export async function getMarkupMultiplier(): Promise<number> {
  const now = Date.now();
  if (cachedMultiplier !== null && now - lastFetch < CACHE_TTL) {
    return cachedMultiplier;
  }

  try {
    const supabaseUrl = getSupabaseUrl();
    const serviceRoleKey = getSupabaseServiceRoleKey();
    if (!supabaseUrl || !serviceRoleKey) return DEFAULT_MULTIPLIER;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "markup_config")
      .single();

    const multiplier = Number(data?.value?.markupMultiplier) || DEFAULT_MULTIPLIER;
    cachedMultiplier = multiplier;
    lastFetch = now;
    return multiplier;
  } catch {
    return cachedMultiplier ?? DEFAULT_MULTIPLIER;
  }
}

export function resetMarkupCache(): void {
  cachedMultiplier = null;
  lastFetch = 0;
}
