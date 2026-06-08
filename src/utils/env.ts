const INVISIBLE_ENV_CHARS = /[\u200B-\u200D\uFEFF]/g;

export function cleanEnvValue(value: string | undefined | null) {
  return value?.replace(INVISIBLE_ENV_CHARS, "").trim();
}

export function getEnv(name: string) {
  const publicEnv: Record<string, string | undefined> = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };

  return cleanEnvValue(publicEnv[name] ?? process.env[name]);
}

export function requireEnv(name: string) {
  const value = getEnv(name);
  if (!value) {
    throw new Error(`${name} is not configured.`);
  }
  return value;
}

export function getSupabaseUrl() {
  return requireEnv("NEXT_PUBLIC_SUPABASE_URL");
}

export function getSupabaseAnonKey() {
  return requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

export function getSupabaseServiceRoleKey() {
  return requireEnv("SUPABASE_SERVICE_ROLE_KEY");
}

export function getDigitalOceanDatabaseUrl() {
  return requireEnv("DIGITALOCEAN_DATABASE_URL");
}
