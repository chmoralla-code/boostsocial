import { createClient as createServiceClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { scrypt, randomBytes, timingSafeEqual, createHmac } from "crypto";
import { getSupabaseUrl, getSupabaseServiceRoleKey } from "@/utils/env";

const SECRETS_TABLE = "admin_secrets";
const PIN_KEY = "admin_pin";
const ATTEMPTS_KEY = "admin_pin_attempts";

export const UNLOCK_COOKIE = "admin_pin_unlocked";
const COOKIE_MAX_AGE_SECONDS = 8 * 60 * 60;
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000;
const KEY_LENGTH = 64;

export const PIN_REGEX = /^\d{4}$/;

type PinConfig = { hash: string; salt: string; updatedAt: string };
type AttemptsState = {
  count: number;
  lockedUntil: string | null;
  lastAttempt: string | null;
};

function getServiceClient() {
  return createServiceClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
    auth: { persistSession: false },
  });
}

function signingSecret() {
  return getSupabaseServiceRoleKey();
}

function scryptAsync(pin: string, salt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    scrypt(pin, salt, KEY_LENGTH, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey.toString("hex"));
    });
  });
}

export async function hashPin(pin: string): Promise<{ hash: string; salt: string }> {
  const salt = randomBytes(16).toString("hex");
  const hash = await scryptAsync(pin, salt);
  return { hash, salt };
}

export async function verifyPin(
  pin: string,
  stored: { hash: string; salt: string }
): Promise<boolean> {
  try {
    const candidate = await scryptAsync(pin, stored.salt);
    const a = Buffer.from(candidate, "hex");
    const b = Buffer.from(stored.hash, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function getPinConfig(): Promise<PinConfig | null> {
  try {
    const db = getServiceClient();
    const { data } = await db
      .from(SECRETS_TABLE)
      .select("value")
      .eq("key", PIN_KEY)
      .single();
    if (!data?.value) return null;
    const v = data.value as Partial<PinConfig>;
    if (!v.hash || !v.salt) return null;
    return { hash: v.hash, salt: v.salt, updatedAt: v.updatedAt ?? new Date().toISOString() };
  } catch {
    return null;
  }
}

export async function isPinSet(): Promise<boolean> {
  return (await getPinConfig()) !== null;
}

export async function setPin(pin: string): Promise<void> {
  const { hash, salt } = await hashPin(pin);
  const db = getServiceClient();
  const value: PinConfig = { hash, salt, updatedAt: new Date().toISOString() };
  const { error } = await db.from(SECRETS_TABLE).upsert(
    { key: PIN_KEY, value, updated_at: new Date().toISOString() },
    { onConflict: "key" }
  );
  if (error) throw new Error(`Failed to set admin PIN: ${error.message}`);
}

async function getAttempts(): Promise<AttemptsState> {
  try {
    const db = getServiceClient();
    const { data } = await db
      .from(SECRETS_TABLE)
      .select("value")
      .eq("key", ATTEMPTS_KEY)
      .single();
    const v = (data?.value ?? {}) as Partial<AttemptsState>;
    return {
      count: v.count ?? 0,
      lockedUntil: v.lockedUntil ?? null,
      lastAttempt: v.lastAttempt ?? null,
    };
  } catch {
    return { count: 0, lockedUntil: null, lastAttempt: null };
  }
}

async function saveAttempts(state: AttemptsState): Promise<void> {
  const db = getServiceClient();
  await db.from(SECRETS_TABLE).upsert(
    { key: ATTEMPTS_KEY, value: state, updated_at: new Date().toISOString() },
    { onConflict: "key" }
  );
}

export type LockStatus = {
  locked: boolean;
  remainingMs: number;
  attemptsRemaining: number;
};

export async function getLockStatus(): Promise<LockStatus> {
  const a = await getAttempts();
  if (a.lockedUntil) {
    const lockedUntilMs = new Date(a.lockedUntil).getTime();
    if (Date.now() < lockedUntilMs) {
      return {
        locked: true,
        remainingMs: lockedUntilMs - Date.now(),
        attemptsRemaining: 0,
      };
    }
  }
  return {
    locked: false,
    remainingMs: 0,
    attemptsRemaining: Math.max(0, MAX_ATTEMPTS - a.count),
  };
}

export async function recordFailedAttempt(): Promise<{ locked: boolean; remainingMs: number }> {
  const a = await getAttempts();
  let count = a.count;
  if (a.lockedUntil && Date.now() >= new Date(a.lockedUntil).getTime()) {
    count = 0;
  }
  count += 1;
  let lockedUntil: string | null = null;
  if (count >= MAX_ATTEMPTS) {
    lockedUntil = new Date(Date.now() + LOCKOUT_MS).toISOString();
  }
  await saveAttempts({ count, lockedUntil, lastAttempt: new Date().toISOString() });
  if (lockedUntil) {
    return { locked: true, remainingMs: LOCKOUT_MS };
  }
  return { locked: false, remainingMs: 0 };
}

export async function resetAttempts(): Promise<void> {
  await saveAttempts({ count: 0, lockedUntil: null, lastAttempt: null });
}

type UnlockPayload = { email: string; exp: number };

function signToken(payload: UnlockPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", signingSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verifyToken(token: string): UnlockPayload | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", signingSecret()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as UnlockPayload;
  } catch {
    return null;
  }
}

export function createUnlockToken(email: string): string {
  return signToken({ email, exp: Date.now() + COOKIE_MAX_AGE_SECONDS * 1000 });
}

export function verifyUnlockToken(
  token: string | undefined | null,
  email: string
): boolean {
  if (!token) return false;
  const payload = verifyToken(token);
  if (!payload) return false;
  if (typeof payload.exp !== "number" || Date.now() > payload.exp) return false;
  if (payload.email !== email) return false;
  return true;
}

export async function isUnlocked(email: string): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(UNLOCK_COOKIE)?.value;
  return verifyUnlockToken(token, email);
}

export const UNLOCK_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: COOKIE_MAX_AGE_SECONDS,
};

export { MAX_ATTEMPTS, LOCKOUT_MS };
