/**
 * Field-level encryption for portal credentials stored in `orders.target_url`.
 *
 * WHY THIS EXISTS
 * ---------------
 * Some services (PisoWiFi, EAP TP-Link) ask the customer for the username and
 * password of their own device portal, and those values were written into the
 * order row as plain text. That text then travelled everywhere the row went:
 * every backup database, every export, every screen that printed the row.
 * Row Level Security closed the public door, but the secret was still sitting
 * in the drawer in the clear.
 *
 * WHAT IT DOES
 * ------------
 * The order text keeps its shape - `Custom Request: [Username: x] [Password: y]`
 * - but the VALUE of any credential-looking field is replaced with an encrypted
 * envelope: `enc:v1:<base64url>`. Labels, links, MAC addresses and every other
 * field are untouched, so nothing downstream has to learn a new format.
 *
 * HOW IT FAILS
 * ------------
 * Quietly, and never by breaking an order:
 *  - No key configured      -> values are stored as before (plain text).
 *  - Value already encrypted -> left exactly as it is (safe to run twice).
 *  - Decryption impossible   -> the envelope is returned as-is, no throw.
 * A read path must never 500 because a secret could not be opened.
 *
 * KEY
 * ---
 * `ORDER_FIELD_KEY`, base64 of 32 random bytes. Server-side only: this module
 * must never be imported by a client component, or the key would ship to the
 * browser with the page. Screens that cannot decrypt use
 * `maskEncryptedValues()` from `@/lib/orderTracking` instead.
 */

import crypto from "node:crypto";
import { getEnv } from "@/utils/env";
import { ENCRYPTED_VALUE_PREFIX } from "@/lib/orderTracking";

const KEY_ENV_NAME = "ORDER_FIELD_KEY";

/**
 * Which bracketed fields hold a secret.
 *
 * Deliberately narrow about the words that are NOT secrets. `[FB Admin: ...]`
 * holds a Facebook profile LINK that the provider needs, and it contains the
 * word "admin" - matching on that alone would encrypt the link and silently
 * break page-setup orders. So the rule keys off the credential words only.
 *
 * Still generous within those: a false positive encrypts a value the admin can
 * still read, while a false negative leaves a password in the clear.
 */
export const SECRET_FIELD_LABEL_RE =
  /pass(?:word)?|pwd|\bpin\b|secret|username|user\s*name|user\s*id|userid|\blogin\b|credential/i;

/**
 * What a sealed value looks like once a screen without the key has shown it.
 * Never re-encrypted: if a customer's edit form round-trips this placeholder,
 * the real secret must survive rather than be overwritten by the mask.
 */
const MASK_PLACEHOLDER_RE = /•{3,}|\[hidden for your security\]/i;

let cachedKey: Buffer | null | undefined;

/** Reads the key once. Returns null when it is missing or the wrong size. */
function loadKey(): Buffer | null {
  if (cachedKey !== undefined) return cachedKey;

  const raw = getEnv(KEY_ENV_NAME);
  if (!raw) {
    cachedKey = null;
    return cachedKey;
  }

  try {
    const key = Buffer.from(raw, "base64");
    cachedKey = key.length === 32 ? key : null;
  } catch {
    cachedKey = null;
  }

  return cachedKey;
}

/** True when a usable key is configured, so callers can report the state. */
export function isFieldEncryptionReady(): boolean {
  return loadKey() !== null;
}

/** Encrypts one value. Returns it unchanged when there is no key to use. */
export function encryptValue(plain: string): string {
  const value = String(plain ?? "");
  if (!value || value.startsWith(ENCRYPTED_VALUE_PREFIX)) return value;
  // A value the customer never re-typed: leave whatever is already stored.
  if (MASK_PLACEHOLDER_RE.test(value)) return value;

  const key = loadKey();
  if (!key) return value;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  // iv | tag | ciphertext, as one URL-safe blob. URL-safe matters: the envelope
  // is stored inside `[Label: value]`, so it must never contain a bracket,
  // a space or a colon.
  return ENCRYPTED_VALUE_PREFIX + Buffer.concat([iv, tag, ciphertext]).toString("base64url");
}

/** Decrypts one value. Returns it unchanged when it is not an envelope. */
export function decryptValue(value: string): string {
  const text = String(value ?? "");
  if (!text.startsWith(ENCRYPTED_VALUE_PREFIX)) return text;

  const key = loadKey();
  if (!key) return text;

  try {
    const blob = Buffer.from(text.slice(ENCRYPTED_VALUE_PREFIX.length), "base64url");
    if (blob.length < 29) return text;

    const iv = blob.subarray(0, 12);
    const tag = blob.subarray(12, 28);
    const ciphertext = blob.subarray(28);

    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    // Wrong key or damaged value: hand back what we have rather than throwing.
    return text;
  }
}

/**
 * Walks the `[Label: value]` fields inside an order text and rewrites each
 * value with `rewrite`. Text outside the brackets is preserved byte for byte.
 */
function mapBracketedFields(
  text: string,
  rewrite: (label: string, value: string) => string
): string {
  if (!text) return text;

  return text.replace(/\[([^[\]]*)\]/g, (whole, inner: string) => {
    const colon = inner.indexOf(":");
    if (colon < 0) return whole;

    const label = inner.slice(0, colon);
    const rawValue = inner.slice(colon + 1);
    const value = rawValue.trim();
    if (!value) return whole;

    const next = rewrite(label, value);
    if (next === value) return whole;
    return `[${label}: ${next}]`;
  });
}

/**
 * Encrypts the secret fields of an order text. Safe to call on text that is
 * already encrypted, on a plain link, or on an empty string.
 */
export function encryptTargetUrlSecrets(text: string): string {
  const source = String(text ?? "");
  if (!source || !source.includes("[")) return source;

  return mapBracketedFields(source, (label, value) =>
    SECRET_FIELD_LABEL_RE.test(label) ? encryptValue(value) : value
  );
}

/** Opens the secret fields of an order text. Non-secret text is untouched. */
export function decryptTargetUrlSecrets(text: string): string {
  const source = String(text ?? "");
  if (!source || !source.includes(ENCRYPTED_VALUE_PREFIX)) return source;

  return mapBracketedFields(source, (_label, value) => decryptValue(value));
}

/** Convenience for rows typed loosely (Supabase hands back `string | null`). */
export function decryptTargetUrlSecretsOrNull(text: string | null | undefined): string | null {
  if (text === null || text === undefined) return null;
  return decryptTargetUrlSecrets(text);
}
