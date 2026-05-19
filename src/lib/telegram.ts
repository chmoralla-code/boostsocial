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
