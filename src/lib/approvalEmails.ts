import { AUTH_EMAIL_BRAND, getSiteOrigin, sendAuthEmail } from "@/utils/auth/email";

type OrderApprovalEmailInput = {
  email?: string | null;
  trackingId: string;
  serviceTitle?: string | null;
  amount?: number | null;
};

type TopupApprovalEmailInput = {
  email?: string | null;
  amount: number;
  newBalance?: number | null;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Email the customer after Telegram (or admin) approval — encourage more orders.
 */
export async function sendOrderApprovedEmail(input: OrderApprovalEmailInput) {
  const to = input.email?.trim().toLowerCase();
  if (!to) return { ok: false as const, error: "email" as const, message: "Missing customer email" };

  const site = getSiteOrigin();
  const trackingId = input.trackingId || "your order";
  const service = (input.serviceTitle || "your service").trim();
  const amountText =
    typeof input.amount === "number" && Number.isFinite(input.amount)
      ? `PHP ${input.amount.toFixed(2)}`
      : null;

  const subject = `${AUTH_EMAIL_BRAND}: Request received — enjoy the services!`;
  const text = [
    `Hi there,`,
    ``,
    `Request received, enjoy the services!`,
    ``,
    `Your order ${trackingId} (${service}) has been approved and is now processing.`,
    amountText ? `Amount: ${amountText}` : null,
    ``,
    `Track your order anytime: ${site}/app/orders`,
    ``,
    `Need more reach? Browse Facebook likes, followers, views, PisoWiFi packages, and more — your next boost is one tap away:`,
    `${site}/app`,
    ``,
    `Thank you for choosing ${AUTH_EMAIL_BRAND}. We're ready when you are.`,
    ``,
    `— ${AUTH_EMAIL_BRAND} Team`,
  ]
    .filter((line) => line !== null)
    .join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;max-width:560px;margin:0 auto">
      <h2 style="margin:0 0 12px;color:#0f766e">${escapeHtml(AUTH_EMAIL_BRAND)}</h2>
      <p style="font-size:18px;margin:0 0 16px"><strong>Request received, enjoy the services!</strong></p>
      <p>Your order <strong>${escapeHtml(trackingId)}</strong> (${escapeHtml(service)}) has been approved and is now processing.${amountText ? ` Amount: <strong>${escapeHtml(amountText)}</strong>.` : ""}</p>
      <p style="margin:24px 0">
        <a href="${escapeHtml(site)}/app/orders" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600">Track my order</a>
      </p>
      <p>Craving more growth? Top up your wallet and grab likes, followers, views, or PisoWiFi packages — faster delivery starts with your next order.</p>
      <p style="margin:24px 0">
        <a href="${escapeHtml(site)}/app" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600">Browse more services</a>
      </p>
      <p style="color:#555;font-size:13px">Thank you for choosing ${escapeHtml(AUTH_EMAIL_BRAND)}. We're ready when you are.</p>
    </div>
  `;

  return sendAuthEmail({ to, subject, text, html });
}

export async function sendTopupApprovedEmail(input: TopupApprovalEmailInput) {
  const to = input.email?.trim().toLowerCase();
  if (!to) return { ok: false as const, error: "email" as const, message: "Missing customer email" };

  const site = getSiteOrigin();
  const amount = Number(input.amount);
  const amountText = Number.isFinite(amount) ? `PHP ${amount.toFixed(2)}` : "your top-up";
  const balanceText =
    typeof input.newBalance === "number" && Number.isFinite(input.newBalance)
      ? `PHP ${input.newBalance.toFixed(2)}`
      : null;

  const subject = `${AUTH_EMAIL_BRAND}: Request received — enjoy the services!`;
  const text = [
    `Hi there,`,
    ``,
    `Request received, enjoy the services!`,
    ``,
    `Your wallet top-up of ${amountText} was approved and credited.`,
    balanceText ? `New balance: ${balanceText}` : null,
    ``,
    `Your wallet is ready — spend it on Facebook likes, followers, views, PisoWiFi packages, and more:`,
    `${site}/app`,
    ``,
    `Thank you for choosing ${AUTH_EMAIL_BRAND}. The more you boost, the faster you grow.`,
    ``,
    `— ${AUTH_EMAIL_BRAND} Team`,
  ]
    .filter((line) => line !== null)
    .join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;max-width:560px;margin:0 auto">
      <h2 style="margin:0 0 12px;color:#0f766e">${escapeHtml(AUTH_EMAIL_BRAND)}</h2>
      <p style="font-size:18px;margin:0 0 16px"><strong>Request received, enjoy the services!</strong></p>
      <p>Your wallet top-up of <strong>${escapeHtml(amountText)}</strong> was approved and credited.${balanceText ? ` New balance: <strong>${escapeHtml(balanceText)}</strong>.` : ""}</p>
      <p>Your wallet is ready — put it to work on likes, followers, views, PisoWiFi packages, and more. The more you boost, the faster you grow.</p>
      <p style="margin:24px 0">
        <a href="${escapeHtml(site)}/app" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600">Shop services now</a>
      </p>
      <p style="color:#555;font-size:13px">Thank you for choosing ${escapeHtml(AUTH_EMAIL_BRAND)}.</p>
    </div>
  `;

  return sendAuthEmail({ to, subject, text, html });
}
