import { createBrowserClient } from '@supabase/ssr'
import { getEnv } from '@/utils/env'

export function createClient() {
  const url = getEnv("NEXT_PUBLIC_SUPABASE_URL") || "https://placeholder.supabase.co";
  const anonKey = getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") || "placeholder-anon-key";
  return createBrowserClient(url, anonKey);
}
