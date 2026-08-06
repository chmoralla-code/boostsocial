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

type OrderCompletedEmailInput = {
  email?: string | null;
  trackingId: string;
  serviceTitle?: string | null;
  amount?: number | null;
  quantity?: number | null;
};

/**
 * Email the customer when an order is marked Completed — thank them and invite another order.
 */
export async function sendOrderCompletedEmail(input: OrderCompletedEmailInput) {
  const to = input.email?.trim().toLowerCase();
  if (!to) return { ok: false as const, error: "email" as const, message: "Missing customer email" };

  const site = getSiteOrigin();
  const trackingId = input.trackingId || "your order";
  const service = (input.serviceTitle || "your service").trim();
  const amountText =
    typeof input.amount === "number" && Number.isFinite(input.amount)
      ? `PHP ${input.amount.toFixed(2)}`
      : null;
  const quantityText =
    typeof input.quantity === "number" && Number.isFinite(input.quantity) && input.quantity > 0
      ? input.quantity.toLocaleString()
      : null;

  const subject = `${AUTH_EMAIL_BRAND}: Your order is complete — enjoy the services!`;
  const text = [
    `Hi there,`,
    ``,
    `Great news — your order is complete. Enjoy the services!`,
    ``,
    `Order ${trackingId} (${service}) has been delivered.`,
    quantityText ? `Quantity: ${quantityText}` : null,
    amountText ? `Amount: ${amountText}` : null,
    ``,
    `Please check your target link. If anything looks off, reply via support from:`,
    `${site}/app/orders`,
    ``,
    `Ready for another boost? Keep the momentum going with more likes, followers, views, or PisoWiFi packages:`,
    `${site}/app`,
    ``,
    `Thank you for choosing ${AUTH_EMAIL_BRAND}. See you on your next order!`,
    ``,
    `— ${AUTH_EMAIL_BRAND} Team`,
  ]
    .filter((line) => line !== null)
    .join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;max-width:560px;margin:0 auto">
      <h2 style="margin:0 0 12px;color:#0f766e">${escapeHtml(AUTH_EMAIL_BRAND)}</h2>
      <p style="font-size:18px;margin:0 0 16px"><strong>Your order is complete — enjoy the services!</strong></p>
      <p>Order <strong>${escapeHtml(trackingId)}</strong> (${escapeHtml(service)}) has been delivered.${quantityText ? ` Quantity: <strong>${escapeHtml(quantityText)}</strong>.` : ""}${amountText ? ` Amount: <strong>${escapeHtml(amountText)}</strong>.` : ""}</p>
      <p>Please check your target link. If anything looks off, open Track Order and chat with support.</p>
      <p style="margin:24px 0">
        <a href="${escapeHtml(site)}/app/orders" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600">View my order</a>
      </p>
      <p>Ready for another boost? Keep the momentum going with more likes, followers, views, or PisoWiFi packages.</p>
      <p style="margin:24px 0">
        <a href="${escapeHtml(site)}/app" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600">Order again</a>
      </p>
      <p style="color:#555;font-size:13px">Thank you for choosing ${escapeHtml(AUTH_EMAIL_BRAND)}. See you on your next order!</p>
    </div>
  `;

  return sendAuthEmail({ to, subject, text, html });
}

type OrderPlacedEmailInput = {
  email?: string | null;
  trackingId: string;
  serviceTitle?: string | null;
  amount?: number | null;
  quantity?: number | null;
  paymentMethod?: string | null;
};

/**
 * Order confirmation / receipt email, sent immediately after a customer places
 * an order (wallet or GCash pending). Includes the tracking ID and, for GCash,
 * the payment steps.
 */
export async function sendOrderPlacedEmail(input: OrderPlacedEmailInput) {
  const to = input.email?.trim().toLowerCase();
  if (!to) return { ok: false as const, error: "email" as const, message: "Missing customer email" };

  const site = getSiteOrigin();
  const trackingId = input.trackingId || "your order";
  const service = (input.serviceTitle || "your service").trim();
  const amountText =
    typeof input.amount === "number" && Number.isFinite(input.amount)
      ? `PHP ${input.amount.toFixed(2)}`
      : null;
  const quantityText =
    typeof input.quantity === "number" && Number.isFinite(input.quantity) && input.quantity > 0
      ? input.quantity.toLocaleString()
      : null;
  const isGcash = String(input.paymentMethod || "").toLowerCase() === "gcash";

  const subject = `${AUTH_EMAIL_BRAND}: Order received — ${trackingId}`;
  const text = [
    `Hi there,`,
    ``,
    `We've received your order ${trackingId} (${service}).`,
    quantityText ? `Quantity: ${quantityText}` : null,
    amountText ? `Amount: ${amountText}` : null,
    ``,
    isGcash
      ? [
          `To complete payment, send the total to our GCash:`,
          `09505339963 • Henry S.`,
          `Then upload your receipt on the tracking page:`,
          `${site}/app/orders`,
        ].join("\n")
      : `Your wallet payment was applied — your order is now processing.`,
    ``,
    `Track your order anytime: ${site}/app/orders`,
    ``,
    `— ${AUTH_EMAIL_BRAND} Team`,
  ]
    .filter((line) => line !== null)
    .flat()
    .join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;max-width:560px;margin:0 auto">
      <h2 style="margin:0 0 12px;color:#0f766e">${escapeHtml(AUTH_EMAIL_BRAND)}</h2>
      <p style="font-size:18px;margin:0 0 16px"><strong>Order received — ${escapeHtml(trackingId)}</strong></p>
      <p>Service: <strong>${escapeHtml(service)}</strong>${quantityText ? ` · Quantity: <strong>${escapeHtml(quantityText)}</strong>` : ""}${amountText ? ` · Amount: <strong>${escapeHtml(amountText)}</strong>` : ""}</p>
      ${
        isGcash
          ? `<p style="margin:20px 0;padding:14px;border-radius:10px;background:#f4f4f5;border:1px solid #e4e4e7">
               <strong>Complete your payment</strong><br/>
               GCash: <strong>09505339963</strong> • Henry S.<br/>
               <span style="font-size:13px;color:#555">Then upload your receipt on the tracking page — your order starts once payment is verified.</span>
             </p>`
          : `<p style="margin:20px 0;padding:14px;border-radius:10px;background:#ecfdf5;border:1px solid #a7f3d0">Wallet payment applied — your order is now processing.</p>`
      }
      <p style="margin:24px 0">
        <a href="${escapeHtml(site)}/app/orders" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600">Track my order</a>
      </p>
      <p style="color:#555;font-size:13px">— ${escapeHtml(AUTH_EMAIL_BRAND)} Team</p>
    </div>
  `;

  return sendAuthEmail({ to, subject, text, html });
}

type TopupPlacedEmailInput = {
  email?: string | null;
  amount: number;
};

/**
 * Top-up receipt confirmation — "we got your receipt, it's being verified."
 */
export async function sendTopupPlacedEmail(input: TopupPlacedEmailInput) {
  const to = input.email?.trim().toLowerCase();
  if (!to) return { ok: false as const, error: "email" as const, message: "Missing customer email" };

  const site = getSiteOrigin();
  const amountText = `PHP ${Number(input.amount || 0).toFixed(2)}`;

  const subject = `${AUTH_EMAIL_BRAND}: Top-up receipt received`;
  const text = [
    `Hi there,`,
    ``,
    `We've received your wallet top-up receipt for ${amountText}.`,
    ``,
    `Our team (or our AI verifier) will check it shortly — you'll get an email the moment your balance is credited.`,
    ``,
    `View your wallet: ${site}/app/profile`,
    ``,
    `— ${AUTH_EMAIL_BRAND} Team`,
  ].join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;max-width:560px;margin:0 auto">
      <h2 style="margin:0 0 12px;color:#0f766e">${escapeHtml(AUTH_EMAIL_BRAND)}</h2>
      <p style="font-size:18px;margin:0 0 16px"><strong>Top-up receipt received</strong></p>
      <p>We've received your wallet top-up receipt for <strong>${escapeHtml(amountText)}</strong>.</p>
      <p>It's being verified now — you'll get an email the moment your balance is credited.</p>
      <p style="margin:24px 0">
        <a href="${escapeHtml(site)}/app/profile" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600">View my wallet</a>
      </p>
      <p style="color:#555;font-size:13px">— ${escapeHtml(AUTH_EMAIL_BRAND)} Team</p>
    </div>
  `;

  return sendAuthEmail({ to, subject, text, html });
}

type LowBalanceEmailInput = {
  email?: string | null;
  balance: number;
};

/**
 * Low-wallet-balance reminder with a one-tap top-up link.
 */
export async function sendLowBalanceEmail(input: LowBalanceEmailInput) {
  const to = input.email?.trim().toLowerCase();
  if (!to) return { ok: false as const, error: "email" as const, message: "Missing customer email" };

  const site = getSiteOrigin();
  const balanceText = `PHP ${Number(input.balance || 0).toFixed(2)}`;

  const subject = `${AUTH_EMAIL_BRAND}: Your wallet balance is running low`;
  const text = [
    `Hi there,`,
    ``,
    `Your PinoyBoosting wallet balance is ${balanceText}.`,
    ``,
    `Top up now so you never miss a boost:`,
    `${site}/app/profile`,
    ``,
    `— ${AUTH_EMAIL_BRAND} Team`,
  ].join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;max-width:560px;margin:0 auto">
      <h2 style="margin:0 0 12px;color:#0f766e">${escapeHtml(AUTH_EMAIL_BRAND)}</h2>
      <p style="font-size:18px;margin:0 0 16px"><strong>Your wallet balance is running low</strong></p>
      <p>Your current balance is <strong>${escapeHtml(balanceText)}</strong>.</p>
      <p>Top up now so you never miss a boost — payments via GCash are usually credited in minutes.</p>
      <p style="margin:24px 0">
        <a href="${escapeHtml(site)}/app/profile" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600">Top up my wallet</a>
      </p>
      <p style="color:#555;font-size:13px">— ${escapeHtml(AUTH_EMAIL_BRAND)} Team</p>
    </div>
  `;

  return sendAuthEmail({ to, subject, text, html });
}

type CheckInEmailInput = {
  email?: string | null;
  reward: number;
  balance: number;
};

/**
 * Daily check-in reward confirmation email.
 */
export async function sendCheckInEmail(input: CheckInEmailInput) {
  const to = input.email?.trim().toLowerCase();
  if (!to) return { ok: false as const, error: "email" as const, message: "Missing customer email" };

  const site = getSiteOrigin();
  const rewardText = `PHP ${Number(input.reward || 0).toFixed(2)}`;
  const balanceText = `PHP ${Number(input.balance || 0).toFixed(2)}`;

  const subject = `${AUTH_EMAIL_BRAND}: Daily check-in bonus claimed 🎉`;
  const text = [
    `Hi there,`,
    ``,
    `You claimed today's check-in bonus of ${rewardText}!`,
    `Your new wallet balance is ${balanceText}.`,
    ``,
    `Come back tomorrow for another bonus:`,
    `${site}/app`,
    ``,
    `— ${AUTH_EMAIL_BRAND} Team`,
  ].join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;max-width:560px;margin:0 auto">
      <h2 style="margin:0 0 12px;color:#0f766e">${escapeHtml(AUTH_EMAIL_BRAND)}</h2>
      <p style="font-size:18px;margin:0 0 16px"><strong>Daily check-in bonus claimed 🎉</strong></p>
      <p>You claimed today's check-in bonus of <strong>${escapeHtml(rewardText)}</strong>!</p>
      <p>Your new wallet balance is <strong>${escapeHtml(balanceText)}</strong>.</p>
      <p>Come back tomorrow for another bonus.</p>
      <p style="margin:24px 0">
        <a href="${escapeHtml(site)}/app" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600">Browse services</a>
      </p>
      <p style="color:#555;font-size:13px">— ${escapeHtml(AUTH_EMAIL_BRAND)} Team</p>
    </div>
  `;

  return sendAuthEmail({ to, subject, text, html });
}
