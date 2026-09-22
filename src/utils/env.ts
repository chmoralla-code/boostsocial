const INVISIBLE_ENV_CHARS = /[\u200B-\u200D\uFEFF]/g;

function unquoteEnvValue(input: string) {
  const trimmed = input.trim();
  if (
    trimmed.length > 1 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    return trimmed.slice(1, -1).replace(INVISIBLE_ENV_CHARS, "").trim();
  }
  return trimmed;
}

export function cleanEnvValue(value: string | undefined | null) {
  let cleaned = value?.replace(INVISIBLE_ENV_CHARS, "").trim();
  if (!cleaned) return cleaned;

  cleaned = unquoteEnvValue(cleaned);

  // Some hosting dashboards store a whole `KEY=value` string in the value field
  // by mistake. That is what broke the AI chat: the stored value was literally
  // "COMMANDCODE_BASE_URL=https://..." so every request went to an invalid URL
  // and the customer only ever saw a canned reply. Strip a leading assignment
  // so a mis-entered variable cannot silently take a feature down again.
  const assignment = cleaned.match(/^[A-Za-z][A-Za-z0-9_]*=([\s\S]*)$/);
  if (assignment) {
    cleaned = unquoteEnvValue(assignment[1].replace(INVISIBLE_ENV_CHARS, "").trim());
  }

  return cleaned;
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
