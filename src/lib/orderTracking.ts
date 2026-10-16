/**
 * Safe order tracking.
 *
 * WHY THIS EXISTS
 * ---------------
 * The track page, the support chatbot and the pending-order banner used to read
 * the `orders` table straight from the browser with the public Supabase key.
 * That worked only because Row Level Security was switched off on `orders` -
 * which also meant anyone could read every order, including the plaintext
 * portal credentials that some services store in `target_url`.
 *
 * With RLS on, those browser reads stop. Tracking now goes through a server
 * route (`/api/orders/track`) that uses the service key and returns ONLY the
 * fields a customer needs, with any stored credentials masked.
 *
 * The returned shape deliberately matches the database row the UI already
 * understands (`target_url`, `services.title`, ...) so the screens did not need
 * rewriting - only their data source changed.
 */

/** Shape returned to the browser. Mirrors the columns the screens read. */
export type SafeTrackedOrder = {
  id: string;
  status: string;
  quantity: number;
  amount: number;
  created_at: string | null;
  target_url: string;
  service_title: string | null;
  services: { title: string | null } | null;
  /** Masked customer email, e.g. `cyr***@gmail.com`. Never the full address. */
  customer_email: string;
  /** True when a stored credential was found in `target_url` and masked. */
  credentialsHidden: boolean;
};

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const TRACK_RE = /BS-([0-9a-f]{8})/i;

/**
 * Marks an encrypted credential value inside `orders.target_url`.
 *
 * Kept in this browser-safe module (and NOT in the module that holds the key)
 * so a screen can recognise an envelope without being able to open it. The
 * matching encrypt/decrypt lives in `@/lib/fieldCrypto`, which is server-only.
 */
export const ENCRYPTED_VALUE_PREFIX = "enc:v1:";

/** The envelope itself, as it appears inside a bracketed field. */
const ENCRYPTED_VALUE_RE = /enc:v1:[A-Za-z0-9_-]+/g;

/**
 * Patterns that mean "a credential is stored in this text". Kept deliberately
 * broad: a false positive only hides a line the customer already knows, while a
 * false negative leaks someone's password.
 */
const CREDENTIAL_PATTERNS: RegExp[] = [
  /\[\s*(?:user(?:name)?|login|email)\s*:[^\]]*\]/gi,
  /\[\s*(?:pass(?:word)?|pwd|pin)\s*:[^\]]*\]/gi,
  /(?:^|\s)(?:user(?:name)?|login|pass(?:word)?|pwd|pin)\s*[:=]\s*\S+/gi,
  /(?:admin|router|portal)\s+(?:pass(?:word)?|pwd)\s*[:=]?\s*\S+/gi,
];

export function containsCredentials(text: string): boolean {
  if (!text) return false;
  return CREDENTIAL_PATTERNS.some((re) => {
    re.lastIndex = 0;
    return re.test(text);
  });
}

/**
 * Replaces every encrypted envelope with a readable placeholder.
 *
 * This is what a screen without the key shows: the label stays visible (so the
 * admin knows a password IS on file) while the sealed value is hidden. Always
 * runs before `redactCredentials`, so an envelope can never be printed raw.
 */
export function maskEncryptedValues(text: string): { value: string; hidden: boolean } {
  if (!text) return { value: "", hidden: false };

  let hidden = false;
  const value = text.replace(ENCRYPTED_VALUE_RE, () => {
    hidden = true;
    return "•••••• (encrypted)";
  });

  return { value, hidden };
}

/**
 * Masks anything that looks like a stored credential, keeping the surrounding
 * text (e.g. the target link) readable.
 */
export function redactCredentials(text: string): { value: string; hidden: boolean } {
  if (!text) return { value: "", hidden: false };

  // Seal first: an envelope must never reach the screen even when its label is
  // one the patterns below do not recognise.
  const sealed = maskEncryptedValues(text);
  let hidden = sealed.hidden;
  let value = sealed.value;

  for (const re of CREDENTIAL_PATTERNS) {
    value = value.replace(re, (match) => {
      // Keep a leading separator/space so the text does not run together.
      const lead = /^\s/.test(match) ? " " : "";
      hidden = true;
      return `${lead}[hidden for your security]`;
    });
  }

  value = value.replace(/\s{2,}/g, " ").trim();
  return { value, hidden };
}

export function displayTrackingId(orderId: string): string {
  return `BS-${String(orderId || "").slice(0, 8).toUpperCase()}`;
}

/**
 * Parses a user-typed tracking reference. Returns the exact UUID when one is
 * given, otherwise a prefix range so a short `BS-XXXXXXXX` form can be matched.
 */
export function parseTrackingInput(
  raw: string
): { kind: "uuid"; value: string } | { kind: "prefix"; value: string } | null {
  const cleanId = String(raw || "").trim();
  if (!cleanId) return null;

  const uuidMatch = cleanId.match(UUID_RE);
  if (uuidMatch) return { kind: "uuid", value: uuidMatch[0].toLowerCase() };

  const trackMatch = cleanId.match(TRACK_RE);
  const shortHex = trackMatch?.[1] || (/^[0-9a-f]{8}$/i.test(cleanId) ? cleanId : "");
  if (!shortHex) return null;

  return { kind: "prefix", value: shortHex.toLowerCase() };
}

type OrderRow = {
  id: string;
  status?: string | null;
  quantity?: number | null;
  amount?: number | string | null;
  created_at?: string | null;
  target_url?: string | null;
  service_title?: string | null;
  customer_email?: string | null;
  services?: { title?: string | null } | Array<{ title?: string | null }> | null;
};

/**
 * Masks an email so a customer can recognise their own order without the full
 * address being exposed to anyone holding a tracking ID.
 */
export function maskEmail(email?: string | null): string {
  const value = String(email || "").trim();
  const at = value.indexOf("@");
  if (at <= 0) return value ? "***" : "";
  const name = value.slice(0, at);
  const domain = value.slice(at);
  const keep = name.slice(0, Math.min(3, name.length));
  return `${keep}***${domain}`;
}

export function toSafeTrackedOrder(row: OrderRow): SafeTrackedOrder {
  const joined = Array.isArray(row.services) ? row.services[0]?.title : row.services?.title;
  const redacted = redactCredentials(String(row.target_url || ""));
  const title = row.service_title || joined || null;

  return {
    id: row.id,
    status: row.status || "Pending",
    quantity: Number(row.quantity || 0),
    amount: Number(row.amount || 0),
    created_at: row.created_at || null,
    target_url: redacted.value,
    service_title: title,
    services: title ? { title } : null,
    customer_email: maskEmail(row.customer_email),
    credentialsHidden: redacted.hidden,
  };
}
