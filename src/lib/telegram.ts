import { createClient } from "@supabase/supabase-js";

const CONFIG_BUCKET = "receipts";
const CONFIG_PATH = "admin-config/telegram.png";
const TOPUP_CONFIG_PATH = "admin-config/telegram-topup.png";
const ADMIN_ORDERS_URL = "https://pinoyboosting.com/admin/orders";
const ADMIN_VIP_URL = "https://pinoyboosting.com/admin/vip";

const getSupabase = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

function truncateTelegramCaption(caption: string) {
  return caption.length > 950 ? `${caption.slice(0, 947)}...` : caption;
}

function toTelegramUrl(value?: string) {
  const trimmed = String(value || "").trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : null;
}

async function getTelegramConfig(): Promise<{ bot_token: string; chat_id: string } | null> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.storage
      .from(CONFIG_BUCKET)
      .download(CONFIG_PATH);

    if (error || !data) return null;
    const text = await data.text();
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function getTopupTelegramConfig(): Promise<{ bot_token: string; chat_id: string } | null> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.storage
      .from(CONFIG_BUCKET)
      .download(TOPUP_CONFIG_PATH);

    if (error || !data) return null;
    const text = await data.text();
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function sendOrderNotification(order: {
  trackingId: string;
  service: string;
  email: string;
  quantity: number;
  amount: number;
  paymentMethod: string;
  details?: string;
}) {
  try {
    const config = await getTelegramConfig();
    if (!config?.bot_token || !config?.chat_id) return;

    const phTime = new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" });

    const escape = (s: string | number) =>
      String(s).replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&");

    const message =
      `🛒 *New Order Received\\!*\n\n` +
      `📦 *Tracking ID:* \`${escape(order.trackingId)}\`\n` +
      `⚡ *Service:* ${escape(order.service)}\n` +
      `👤 *Customer:* ${escape(order.email)}\n` +
      `🔢 *Quantity:* ${escape(order.quantity)}\n` +
      `💰 *Amount:* ₱${escape(order.amount.toFixed(2))}\n` +
      `💳 *Payment:* ${escape(order.paymentMethod)}\n` +
      (order.details ? `📝 *Details:* ${escape(order.details.slice(0, 100))}\n` : "") +
      `🕐 *Time:* ${escape(phTime)} PHT`;

    await fetch(`https://api.telegram.org/bot${config.bot_token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: config.chat_id,
        text: message,
        parse_mode: "MarkdownV2",
      }),
    });
  } catch (err) {
    console.error("Telegram notification failed:", err);
  }
}

async function getAnyTelegramConfig(): Promise<{ bot_token: string; chat_id: string } | null> {
  return await getTelegramConfig() || await getTopupTelegramConfig();
}

export async function sendOrderApprovalNotification(order: {
  orderId: string;
  trackingId: string;
  service: string;
  email: string;
  quantity: number;
  amount: number;
  paymentMethod: string;
  receiptUrl: string;
  details?: string;
}) {
  try {
    const config = await getTopupTelegramConfig() || await getTelegramConfig();
    if (!config?.bot_token || !config?.chat_id) return;

    const phTime = new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" });

    const targetUrl = toTelegramUrl(order.details);
    const inlineKeyboard = [
      [
        { text: "Approve -> Processing", callback_data: `order_approve_${order.orderId}` },
        { text: "Reject / Cancel", callback_data: `order_reject_${order.orderId}` }
      ],
      ...(targetUrl ? [[{ text: "Open Target Link", url: targetUrl }]] : []),
      [{ text: "Open Admin Orders", url: ADMIN_ORDERS_URL }]
    ];

    const caption = truncateTelegramCaption(
      `New GCash order needs approval\n\n` +
      `Tracking ID: ${order.trackingId}\n` +
      `Service: ${order.service}\n` +
      `Customer: ${order.email}\n` +
      `Quantity: ${order.quantity}\n` +
      `Amount: PHP ${order.amount.toFixed(2)}\n` +
      `Payment: ${order.paymentMethod}\n` +
      (order.details ? `Details: ${order.details.slice(0, 250)}\n` : "") +
      `Time: ${phTime} PHT\n\n` +
      `Receipt proof is attached. Approve only when the GCash payment amount matches this order.`
    );

    const res = await fetch(`https://api.telegram.org/bot${config.bot_token}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: config.chat_id,
        photo: order.receiptUrl,
        caption,
        reply_markup: {
          inline_keyboard: inlineKeyboard
        }
      }),
    });

    const data = await res.json();
    if (!data.ok) {
      console.error("Telegram order approval sendPhoto failed:", data.description);
    }
  } catch (err) {
    console.error("Telegram order approval notification failed:", err);
  }
}

export async function sendOrderCompleteNotification(order: {
  trackingId: string;
  service: string;
  email: string;
  quantity: number;
  amount: number;
  paymentMethod: string;
  details?: string;
}) {
  try {
    const config = await getTelegramConfig();
    if (!config?.bot_token || !config?.chat_id) return;

    const phTime = new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" });

    const escape = (s: string | number) =>
      String(s).replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&");

    const message =
      `✅ *Order Completed\\!*\n\n` +
      `📦 *Tracking ID:* \`${escape(order.trackingId)}\`\n` +
      `⚡ *Service:* ${escape(order.service)}\n` +
      `👤 *Customer:* ${escape(order.email)}\n` +
      `🔢 *Quantity:* ${escape(order.quantity)}\n` +
      `💰 *Amount:* ₱${escape(order.amount.toFixed(2))}\n` +
      `💳 *Payment:* ${escape(order.paymentMethod)}\n` +
      (order.details ? `🔗 *Link:* ${escape(order.details)}\n` : "") +
      `🕐 *Completed At:* ${escape(phTime)} PHT`;

    await fetch(`https://api.telegram.org/bot${config.bot_token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: config.chat_id,
        text: message,
        parse_mode: "MarkdownV2",
      }),
    });
  } catch (err) {
    console.error("Telegram order completion notification failed:", err);
  }
}

export async function sendTopupNotification(topup: {
  topupId: string;
  email: string;
  amount: number;
  receiptUrl: string;
}) {
  try {
    const config = await getTopupTelegramConfig();
    if (!config?.bot_token || !config?.chat_id) return;

    const phTime = new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" });

    const caption =
      `💰 New Wallet Top-Up Request!\n\n` +
      `👤 Customer: ${topup.email}\n` +
      `💵 Amount: ₱${topup.amount.toFixed(2)}\n` +
      `🕐 Time: ${phTime} PHT\n\n` +
      `⬇️ Tap a button below to approve or reject.`;

    // Send receipt photo with inline approve/reject buttons
    const res = await fetch(`https://api.telegram.org/bot${config.bot_token}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: config.chat_id,
        photo: topup.receiptUrl,
        caption: caption,
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ Approve Top-Up", callback_data: `topup_approve_${topup.topupId}` },
              { text: "❌ Reject", callback_data: `topup_reject_${topup.topupId}` }
            ]
          ]
        }
      }),
    });

    const data = await res.json();
    if (!data.ok) {
      console.error("Telegram sendPhoto failed:", data.description);
    }
  } catch (err) {
    console.error("Telegram top-up notification failed:", err);
  }
}

export async function sendVipSubscriptionNotification(args: {
  subscriptionId: string;
  email: string;
  plan: {
    label: string;
    id: string;
    durationDays: number;
    price: number;
    discountPercent: number;
  };
  amount: number;
  receiptUrl: string;
}) {
  try {
    const config = await getTopupTelegramConfig();
    if (!config?.bot_token || !config?.chat_id) return;

    const phTime = new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" });
    const caption =
      `ðŸšª New VIP Subscription Request\n\n` +
      `âœ“ ID: ${args.subscriptionId}\n` +
      `â“‚ Email: ${args.email}\n` +
      `ðŸŽ“ Plan: ${args.plan.label} (${args.plan.id})\n` +
      `ðŸ“ Duration: ${args.plan.durationDays} days\n` +
      `ðŸ’° Amount: â‚±${args.amount.toFixed(2)}\n` +
      `ðŸ’³ Method: GCash\n` +
      `ðŸ• Time: ${phTime} PHT\n\n` +
      `Open admin VIP queue to approve or reject after reviewing the receipt.`;

    const res = await fetch(`https://api.telegram.org/bot${config.bot_token}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: config.chat_id,
        photo: args.receiptUrl,
        caption,
        reply_markup: {
          inline_keyboard: [
            [
              { text: "Open VIP Subscriptions", url: ADMIN_VIP_URL }
            ]
          ]
        }
      }),
    });

    const data = await res.json();
    if (!data.ok) {
      console.error("Telegram VIP notification sendPhoto failed:", data.description);
    }
  } catch (err) {
    console.error("Telegram VIP subscription notification failed:", err);
  }
}

export async function sendAdminAlert(alert: {
  title: string;
  message: string;
}) {
  try {
    const config = await getAnyTelegramConfig();
    if (!config?.bot_token || !config?.chat_id) return;

    const text = `${alert.title}\n\n${alert.message}`;
    await fetch(`https://api.telegram.org/bot${config.bot_token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: config.chat_id,
        text,
      }),
    });
  } catch (err) {
    console.error("Telegram admin alert failed:", err);
  }
}
