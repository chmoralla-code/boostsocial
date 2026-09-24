export const AUTH_EMAIL_FROM = "PINOYBOOSTING <noreply@pinoyboosting.com>";
export const AUTH_EMAIL_BRAND = "PINOYBOOSTING";

const RESEND_MAX_ATTEMPTS = 3;
const RESEND_RETRY_DELAYS_MS = [700, 2000];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

type SendEmailResult =
  | { ok: true }
  | { ok: false; error: "config" | "email"; message: string; status?: number };

/**
 * Send a transactional email through Resend.
 */
export async function sendAuthEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.error("RESEND_API_KEY is not set — cannot send email");
    return {
      ok: false,
      error: "config",
      message: "Email delivery is not configured on the server. Please contact support.",
    };
  }

  const payload = JSON.stringify({
    from: AUTH_EMAIL_FROM,
    to: input.to.trim().toLowerCase(),
    subject: input.subject,
    text: input.text,
    html: input.html,
  });

  // Resend returns 429 when the per-second or daily quota is hit and 5xx on
  // transient outages. Retry those a couple of times before giving up so a
  // brief spike doesn't leave a customer with no verification code.
  let lastStatus: number | undefined;
  for (let attempt = 0; attempt < RESEND_MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) await sleep(RESEND_RETRY_DELAYS_MS[attempt - 1] ?? 2000);
    try {
      const sendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: payload,
      });

      if (sendRes.ok) return { ok: true };

      lastStatus = sendRes.status;
      const body = await sendRes.text().catch(() => "");
      console.error(`Resend send failed (attempt ${attempt + 1}):`, sendRes.status, body);
      if (sendRes.status !== 429 && sendRes.status < 500) break;
    } catch (err) {
      console.error(`Resend fetch failed (attempt ${attempt + 1}):`, err);
    }
  }

  return {
    ok: false,
    error: "email",
    status: lastStatus,
    message: "Failed to send email. Please try again.",
  };
}

export function getSiteOrigin() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://pinoyboosting.com"
  ).replace(/\/$/, "");
}
