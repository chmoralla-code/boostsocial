export const AUTH_EMAIL_FROM = "PINOYBOOSTING <noreply@pinoyboosting.com>";
export const AUTH_EMAIL_BRAND = "PINOYBOOSTING";

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

  try {
    const sendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: AUTH_EMAIL_FROM,
        to: input.to.trim().toLowerCase(),
        subject: input.subject,
        text: input.text,
        html: input.html,
      }),
    });

    if (!sendRes.ok) {
      const body = await sendRes.text().catch(() => "");
      console.error("Resend send failed:", sendRes.status, body);
      return {
        ok: false,
        error: "email",
        status: sendRes.status,
        message: "Failed to send email. Please try again.",
      };
    }

    return { ok: true };
  } catch (err) {
    console.error("Resend fetch failed:", err);
    return {
      ok: false,
      error: "email",
      message: "Failed to reach the email service. Please try again.",
    };
  }
}

export function getSiteOrigin() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://pinoyboosting.com"
  ).replace(/\/$/, "");
}
