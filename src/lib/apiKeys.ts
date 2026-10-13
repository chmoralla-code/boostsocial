import { createHash, randomBytes } from "node:crypto";

/**
 * Reseller API key helpers.
 *
 * Key shape:  pbk_<43 url-safe chars>   (32 random bytes, base64url)
 *
 * Only the SHA-256 hash is ever stored. The plain key is shown to the
 * reseller once, at creation, and can never be recovered afterwards.
 *
 * Why a plain SHA-256 is enough here (unlike a password): the key carries
 * 256 bits of random entropy, so there is nothing to brute-force offline.
 * Passwords are low-entropy and need a slow hash; random keys do not.
 */

export const API_KEY_PREFIX = "pbk_";

/** How much of the key is safe to show in the UI for identification. */
const DISPLAY_PREFIX_LENGTH = 12;

export type GeneratedApiKey = {
  /** The full key. Shown once, never stored. */
  key: string;
  /** Short, non-secret identifier for lists and logs. */
  keyPrefix: string;
  /** What actually goes in the database. */
  keyHash: string;
};

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key.trim()).digest("hex");
}

export function generateApiKey(): GeneratedApiKey {
  const secret = randomBytes(32).toString("base64url");
  const key = `${API_KEY_PREFIX}${secret}`;

  return {
    key,
    keyPrefix: key.slice(0, DISPLAY_PREFIX_LENGTH),
    keyHash: hashApiKey(key),
  };
}

/**
 * Pulls the key out of a request.
 *
 * Three places, in order of preference:
 *   1. `Authorization: Bearer pbk_...`
 *   2. `X-API-Key: pbk_...`
 *   3. a `key` field in the body — the shape every SMM panel script uses
 */
export function extractApiKey(
  headers: Headers,
  body?: Record<string, unknown> | null
): string | null {
  const authorization = headers.get("authorization");
  if (authorization) {
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (match?.[1]) return match[1].trim();
  }

  const headerKey = headers.get("x-api-key");
  if (headerKey) return headerKey.trim();

  const bodyKey = body?.key;
  if (typeof bodyKey === "string" && bodyKey.trim()) return bodyKey.trim();

  return null;
}

/**
 * Parses the incoming request body.
 *
 * Accepts JSON and form-encoded bodies, because resellers arrive with
 * scripts written for both. A `Content-Type` that lies is tolerated: if
 * JSON parsing fails on a form-shaped body, the form parser still runs.
 */
export async function readApiBody(
  req: Request
): Promise<Record<string, unknown>> {
  const contentType = req.headers.get("content-type") || "";

  try {
    const raw = await req.text();
    if (!raw.trim()) return {};

    if (contentType.includes("application/json")) {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object"
        ? (parsed as Record<string, unknown>)
        : {};
    }

    const params = new URLSearchParams(raw);
    const out: Record<string, unknown> = {};
    for (const [key, value] of params.entries()) out[key] = value;

    // A body sent with the wrong content-type still usually holds JSON.
    if (Object.keys(out).length === 1 && "raw" in out === false) {
      const only = Object.values(out)[0];
      if (typeof only === "string" && only.trim().startsWith("{")) {
        try {
          const parsed = JSON.parse(only);
          if (parsed && typeof parsed === "object") {
            return parsed as Record<string, unknown>;
          }
        } catch {
          // Not JSON after all — keep the form parse.
        }
      }
    }

    return out;
  } catch {
    return {};
  }
}

/** Reads a string field from an untyped body. */
export function bodyString(
  body: Record<string, unknown>,
  ...names: string[]
): string | null {
  for (const name of names) {
    const value = body[name];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

/** Reads a positive integer field from an untyped body. */
export function bodyInt(
  body: Record<string, unknown>,
  ...names: string[]
): number | null {
  const raw = bodyString(body, ...names);
  if (raw === null) return null;
  const value = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.floor(value);
}

/**
 * Best-effort client IP, used only for the audit log and an optional
 * allowlist. Never trusted for authentication.
 */
export function clientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() || null;
}

/** True when `ip` is permitted by a key's allowlist (null = any IP). */
export function ipAllowed(
  allowedIps: unknown,
  ip: string | null
): boolean {
  if (allowedIps === null || allowedIps === undefined) return true;
  if (!Array.isArray(allowedIps) || allowedIps.length === 0) return true;
  if (!ip) return false;
  return allowedIps.some((entry) => String(entry).trim() === ip);
}

/** Uniform error body, matching the shape SMM scripts expect. */
export function apiError(message: string, code?: string) {
  return { error: message, ...(code ? { code } : {}) };
}

/**
 * Maps an RPC error code to the HTTP status and message a reseller sees.
 * Kept in one place so every endpoint answers consistently.
 */
export function rpcErrorToResponse(code: string | null): {
  status: number;
  message: string;
} {
  switch (code) {
    case "INVALID_KEY":
      return { status: 401, message: "Invalid API key." };
    case "KEY_REVOKED":
      return { status: 401, message: "This API key has been revoked." };
    case "RATE_LIMITED":
      return {
        status: 429,
        message: "Too many requests. Please slow down and retry shortly.",
      };
    case "DAILY_LIMIT":
      return { status: 403, message: "Daily spend limit reached for this key." };
    case "MONTHLY_LIMIT":
      return { status: 403, message: "Monthly spend limit reached for this key." };
    case "INSUFFICIENT_BALANCE":
      return {
        status: 402,
        message: "Insufficient wallet balance. Please top up your wallet.",
      };
    case "NO_PROFILE":
      return { status: 409, message: "Wallet owner profile was not found." };
    case "INVALID_AMOUNT":
      return { status: 400, message: "Invalid order amount." };
    default:
      return { status: 500, message: "Something went wrong. Please retry." };
  }
}
