import crypto from "crypto";
import { getEnv, requireEnv } from "@/utils/env";

// PayMongo REST base. Every amount on the wire is an INTEGER in centavos,
// so PHP 99.00 is 9900.
const PAYMONGO_API = "https://api.paymongo.com/v1";

// E-wallets + QR only, on purpose: cards carry the highest chargeback risk
// for boosted-engagement orders. Add "card" here only if you accept that risk.
export const PAYMONGO_PAYMENT_METHODS = ["gcash", "paymaya", "qrph"] as const;

export function getPaymongoSecretKey() {
  return requireEnv("PAYMONGO_SECRET_KEY");
}

export function getPaymongoWebhookSecret() {
  return requireEnv("PAYMONGO_WEBHOOK_SECRET");
}

/** True when the gateway is wired up, so UI can hide the option otherwise. */
export function isPaymongoConfigured() {
  return Boolean(getEnv("PAYMONGO_SECRET_KEY") && getEnv("PAYMONGO_WEBHOOK_SECRET"));
}

/**
 * True while the secret key is a PayMongo TEST key. Test money is not real
 * money, so every admin alert is tagged so it can never be mistaken for a
 * live transaction in the Telegram channel.
 */
export function isPaymongoTestMode() {
  return getPaymongoSecretKey().startsWith("sk_test_");
}

/** Basic auth: the secret key is the username, the password is empty. */
function authHeader() {
  const secret = getPaymongoSecretKey();
  return "Basic " + Buffer.from(`${secret}:`).toString("base64");
}

export function phpToCentavos(amount: number) {
  return Math.round(amount * 100);
}

export type PaymongoCheckoutSession = {
  id: string;
  checkoutUrl: string;
  status: string;
};

export async function createCheckoutSession(input: {
  amountCentavos: number;
  description: string;
  referenceNumber: string;
  metadata: Record<string, string>;
  successUrl: string;
  cancelUrl: string;
  idempotencyKey: string;
}): Promise<PaymongoCheckoutSession> {
  const res = await fetch(`${PAYMONGO_API}/checkout_sessions`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
      // A double-click must not create two payable sessions.
      "Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify({
      data: {
        attributes: {
          send_email_receipt: false,
          show_description: true,
          show_line_items: true,
          description: input.description,
          reference_number: input.referenceNumber,
          metadata: input.metadata,
          payment_method_types: [...PAYMONGO_PAYMENT_METHODS],
          line_items: [
            {
              currency: "PHP",
              amount: input.amountCentavos,
              name: "PinoyBoosting Wallet Top-Up",
              quantity: 1,
            },
          ],
          success_url: input.successUrl,
          cancel_url: input.cancelUrl,
        },
      },
    }),
  });

  const json: any = await res.json().catch(() => null);

  if (!res.ok) {
    const detail =
      json?.errors?.[0]?.detail ||
      json?.errors?.[0]?.code ||
      `PayMongo request failed (${res.status}).`;
    // Never log the key or the raw signature — only the API's own message.
    throw new Error(detail);
  }

  const session = json?.data;
  const checkoutUrl = session?.attributes?.checkout_url;
  if (!session?.id || !checkoutUrl) {
    throw new Error("PayMongo did not return a checkout URL.");
  }

  return {
    id: session.id,
    checkoutUrl,
    status: session?.attributes?.status || "active",
  };
}

/**
 * Verify the `Paymongo-Signature` header.
 *
 * The header looks like `t=1699999999,te=<hex>,li=<hex>` and the signed
 * payload is `${t}.${rawBody}`. Compare timing-safely against both the test
 * (te) and live (li) digests. Any parse problem means "not verified" — we
 * never guess.
 */
export function verifyPaymongoSignature(rawBody: string, header: string | null) {
  if (!header) return false;

  try {
    const parts: Record<string, string> = {};
    for (const chunk of header.split(",")) {
      const index = chunk.indexOf("=");
      if (index === -1) continue;
      parts[chunk.slice(0, index).trim()] = chunk.slice(index + 1).trim();
    }

    const timestamp = parts["t"];
    const candidates = [parts["te"], parts["li"]].filter(Boolean) as string[];
    if (!timestamp || candidates.length === 0) return false;

    const secret = getPaymongoWebhookSecret();
    const expected = crypto
      .createHmac("sha256", secret)
      .update(`${timestamp}.${rawBody}`)
      .digest("hex");

    const expectedBuffer = Buffer.from(expected, "hex");

    return candidates.some((candidate) => {
      let given: Buffer;
      try {
        given = Buffer.from(candidate, "hex");
      } catch {
        return false;
      }
      if (given.length !== expectedBuffer.length) return false;
      return crypto.timingSafeEqual(given, expectedBuffer);
    });
  } catch {
    return false;
  }
}

/**
 * Pull the useful bits out of a PayMongo event without assuming one exact
 * payload shape. PayMongo nests the resource under data.attributes.data and
 * the field names differ slightly between event types and API versions, so we
 * accept several known spellings and let the caller decide what to do with a
 * missing value.
 */
export type PaymongoPaidDetails = {
  sessionId: string | null;
  referenceNumber: string | null;
  paidCentavos: number | null;
  paymentId: string | null;
  method: string | null;
};

export function extractPaidDetails(event: any): PaymongoPaidDetails {
  const attributes = event?.data?.attributes || {};
  const resource = attributes.data || {};
  const resourceAttributes = resource.attributes || {};

  const resourceId: string | undefined = resource?.id;

  const sessionId =
    resourceId?.startsWith("cs_")
      ? resourceId
      : resourceAttributes.checkout_session_id || null;

  const referenceNumber =
    resourceAttributes.reference_number ||
    resource?.reference_number ||
    null;

  const payments: any[] = Array.isArray(resourceAttributes.payments)
    ? resourceAttributes.payments
    : [];

  const payment =
    payments.find((p) => p?.attributes?.status === "paid") || payments[0] || null;

  const paidCentavos =
    typeof payment?.attributes?.amount === "number"
      ? payment.attributes.amount
      : typeof resourceAttributes.amount === "number"
        ? resourceAttributes.amount
        : null;

  const paymentId =
    payment?.id || (resourceId?.startsWith("pay_") ? resourceId : null);

  const method =
    payment?.attributes?.source?.type ||
    payment?.attributes?.payment_method_used ||
    resourceAttributes?.payment_method_used ||
    null;

  return { sessionId, referenceNumber, paidCentavos, paymentId, method };
}
