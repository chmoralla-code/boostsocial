import { createClient } from "@supabase/supabase-js";

const CONFIG_BUCKET = "receipts";
const CONFIG_PATH = "admin-config/telegram.png";

const getSupabase = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

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
    const config = await getTelegramConfig();
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
