/**
 * Payment-proof rules shared by the receipt verifier.
 *
 * These functions deliberately do not make approval decisions on their own.
 * The verifier must also confirm a real receipt, matching PHP amount, unique
 * reference, adequate OCR confidence, and no strong tampering signal.
 */

/** Canonical GCash payee shown on the site (masked on direct GCash receipts). */
export const APPROVED_GCASH_RECEIVER_LABEL = "HE•••Y S.";

/** Public receiving GCash number shown at checkout: 09505339963. */
export const APPROVED_GCASH_ACCOUNT_LAST_FOUR = "9963";

export type PaymentDestinationEvidence = {
  recipient?: string | null;
  recipientAccount?: string | null;
  recipientInstitution?: string | null;
};

function digitsOnly(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

/**
 * Preserve a transfer provider's alpha prefix (for example InstaPay's
 * IT0260731134416022) while removing visual separators.
 */
export function normalizePaymentReference(value: unknown): string | null {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

  return normalized.length >= 8 ? normalized : null;
}

/**
 * Legacy GCash reference normalization retained for duplicate checks against
 * previously stored, digits-only values.
 */
export function normalizeGcashReference(value: unknown): string | null {
  const digits = digitsOnly(value);
  return digits.length >= 8 ? digits : null;
}

/**
 * Accept the masked GCash receiver shown by the GCash app, plus the known
 * unmasked name. A bare "Henry" is intentionally not enough on its own.
 */
export function isApprovedGCashReceiver(name: unknown): boolean {
  const raw = String(name ?? "").trim().toUpperCase();
  if (!raw) return false;

  if (/^HE[•·*.…\-_]+Y\s*S\.?$/.test(raw)) return true;
  if (/^HENRY\s*S\.?$/.test(raw)) return true;

  const letters = raw.replace(/[^A-Z]/g, "");
  return letters === "HEYS" || letters === "HENRYS";
}

/**
 * A bank / InstaPay proof can abbreviate the payee to only "Henry". In that
 * case, require all three visible destination clues before it is treated as
 * the site GCash account: recipient name, GCash/G-Xchange institution, and
 * account number ending in 9963. This is stricter than accepting the name
 * alone and supports the exact transfer shape in the reported video.
 */
export function isApprovedPaymentDestination({
  recipient,
  recipientAccount,
  recipientInstitution,
}: PaymentDestinationEvidence): boolean {
  if (isApprovedGCashReceiver(recipient)) return true;

  const recipientName = String(recipient ?? "").trim().toUpperCase();
  const destinationDetails = [recipient, recipientAccount, recipientInstitution]
    .filter(Boolean)
    .join(" ");
  const hasHenry = /(?:^|[^A-Z])HENRY(?:$|[^A-Z])/.test(recipientName);
  const hasKnownGcashSuffix = digitsOnly(destinationDetails).endsWith(
    APPROVED_GCASH_ACCOUNT_LAST_FOUR
  );
  const hasGcashInstitution = /(?:G\s*[-–—]?\s*XCHANGE|GCASH)/i.test(
    destinationDetails
  );

  return hasHenry && hasKnownGcashSuffix && hasGcashInstitution;
}

export function expectedPaymentDestinationLabel() {
  return `${APPROVED_GCASH_RECEIVER_LABEL} / Henry S., or Henry at GCash ending ${APPROVED_GCASH_ACCOUNT_LAST_FOUR}`;
}
