import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { autoPlaceRixeyOrder } from "@/lib/rixeysmm";
import { syncBackupAdminClients } from "@/utils/supabase/dual-db";
import { enforceRateLimit } from "@/utils/security/rate-limit";

const CONFIG_BUCKET = "receipts";
const ORDER_CONFIG_PATH = "admin-config/telegram.png";
const TOPUP_CONFIG_PATH = "admin-config/telegram-topup.png";

type TelegramConfig = { bot_token: string; chat_id: string };

const getSupabase = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

async function getTelegramConfig(path: string): Promise<TelegramConfig | null> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.storage
      .from(CONFIG_BUCKET)
      .download(path);

    if (error || !data) return null;
    const text = await data.text();
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function getOrderActionConfig() {
  return await getTelegramConfig(TOPUP_CONFIG_PATH) || await getTelegramConfig(ORDER_CONFIG_PATH);
}

export async function POST(req: NextRequest) {
  try {
    const rateLimitResponse = enforceRateLimit(req, {
      key: "telegram-webhook",
      maxRequests: 120,
      windowMs: 60_000,
    });
    if (rateLimitResponse) return rateLimitResponse;

    const configuredSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
    if (!configuredSecret) {
      return NextResponse.json({ ok: false, error: "Webhook secret not configured." }, { status: 500 });
    }

    const receivedSecret = req.headers.get("x-telegram-bot-api-secret-token")?.trim();
    if (receivedSecret !== configuredSecret) {
      return NextResponse.json({ ok: false, error: "Invalid webhook signature." }, { status: 401 });
    }

    const body = await req.json();

    if (!body.callback_query) {
      return NextResponse.json({ ok: true });
    }

    const callbackQuery = body.callback_query;
    const callbackData = callbackQuery.data as string;
    const chatId = callbackQuery.message?.chat?.id;
    const messageId = callbackQuery.message?.message_id;
    const callbackQueryId = callbackQuery.id;

    if (callbackData.startsWith("topup_approve_") || callbackData.startsWith("topup_reject_")) {
      await handleTopupAction(callbackData, chatId, messageId, callbackQueryId);
      return NextResponse.json({ ok: true });
    }

    if (callbackData.startsWith("order_approve_") || callbackData.startsWith("order_reject_")) {
      await handleOrderAction(callbackData, chatId, messageId, callbackQueryId);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Telegram webhook error:", err);
    return NextResponse.json({ ok: true });
  }
}

async function handleTopupAction(callbackData: string, chatId: number, messageId: number, callbackQueryId: string) {
  const config = await getTelegramConfig(TOPUP_CONFIG_PATH);
  if (!config?.bot_token) return;

  const isApprove = callbackData.startsWith("topup_approve_");
  const topupId = callbackData.replace("topup_approve_", "").replace("topup_reject_", "");
  const supabase = getSupabase();

  const { data: topup, error: topupError } = await supabase
    .from("topups")
    .select("*")
    .eq("id", topupId)
    .single();

  if (topupError || !topup) {
    await answerCallback(config.bot_token, callbackQueryId, "Top-up not found.");
    return;
  }

  if (topup.status !== "pending") {
    await answerCallback(config.bot_token, callbackQueryId, `Already ${topup.status}.`);
    await removeButtons(config.bot_token, chatId, messageId);
    return;
  }

  if (isApprove) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("balance, referred_by")
      .eq("id", topup.user_id)
      .single();

    if (profileError || !profile) {
      await answerCallback(config.bot_token, callbackQueryId, "User profile not found.");
      return;
    }

    const topupAmount = Number(topup.amount);
    const newBalance = Number(profile.balance || 0) + topupAmount;

    await supabase
      .from("profiles")
      .update({ balance: newBalance })
      .eq("id", topup.user_id);

    await supabase
      .from("topups")
      .update({ status: "approved" })
      .eq("id", topupId);

    if (profile.referred_by) {
      const commission = topupAmount * 0.10;
      const { data: referrer } = await supabase
        .from("profiles")
        .select("balance")
        .eq("id", profile.referred_by)
        .single();

      if (referrer) {
        const referrerNewBalance = Number(referrer.balance || 0) + commission;
        await supabase
          .from("profiles")
          .update({ balance: referrerNewBalance })
          .eq("id", profile.referred_by);

        await supabase
          .from("referral_transactions")
          .insert([{
            referrer_id: profile.referred_by,
            referee_id: topup.user_id,
            amount: commission,
            description: `10% referral commission from approved top-up of PHP ${topupAmount.toFixed(2)}`
          }]);
      }
    }

    await answerCallback(config.bot_token, callbackQueryId, `Approved! PHP ${topupAmount.toFixed(2)} credited.`);
    await editCaption(
      config.bot_token,
      chatId,
      messageId,
      `TOP-UP APPROVED\n\nCustomer: ${topup.email}\nAmount: PHP ${topupAmount.toFixed(2)}\nNew Balance: PHP ${newBalance.toFixed(2)}\n\nApproved via Telegram by Admin.`
    );
  } else {
    await supabase
      .from("topups")
      .update({ status: "rejected" })
      .eq("id", topupId);

    await answerCallback(config.bot_token, callbackQueryId, "Top-up rejected.");
    await editCaption(
      config.bot_token,
      chatId,
      messageId,
      `TOP-UP REJECTED\n\nCustomer: ${topup.email}\nAmount: PHP ${Number(topup.amount).toFixed(2)}\n\nRejected via Telegram by Admin.`
    );
  }

  await removeButtons(config.bot_token, chatId, messageId);
}

async function handleOrderAction(callbackData: string, chatId: number, messageId: number, callbackQueryId: string) {
  const config = await getOrderActionConfig();
  if (!config?.bot_token) return;

  const isApprove = callbackData.startsWith("order_approve_");
  const orderId = callbackData.replace("order_approve_", "").replace("order_reject_", "");
  const supabase = getSupabase();

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select(`
      status,
      service_id,
      target_url,
      quantity,
      external_order_id,
      customer_email,
      amount,
      payment_method,
      services (
        title
      )
    `)
    .eq("id", orderId)
    .single();

  if (orderError || !order) {
    await answerCallback(config.bot_token, callbackQueryId, "Order not found.");
    return;
  }

  if (order.status !== "Pending") {
    await answerCallback(config.bot_token, callbackQueryId, `Already ${order.status}.`);
    await removeButtons(config.bot_token, chatId, messageId);
    return;
  }

  const newStatus = isApprove ? "Processing" : "Rejected";
  const { error: updateError } = await supabase
    .from("orders")
    .update({ status: newStatus })
    .eq("id", orderId);

  if (updateError) {
    await answerCallback(config.bot_token, callbackQueryId, `Failed to update order: ${updateError.message}`);
    return;
  }

  await syncBackupAdminClients(async (backupClient) => {
    await backupClient
      .from("orders")
      .update({ status: newStatus })
      .eq("id", orderId);
  }, "telegram order status sync");

  const serviceTitle = Array.isArray((order as any).services)
    ? (order as any).services[0]?.title
    : (order as any).services?.title;
  const trackingId = `BS-${orderId.slice(0, 8).toUpperCase()}`;

  if (isApprove) {
    if (!order.external_order_id) {
      autoPlaceRixeyOrder(orderId, order.service_id, order.target_url, order.quantity).catch((err) => {
        console.error("Async auto-placement on RixeySMM from Telegram approval failed:", err);
      });
    }

    await answerCallback(config.bot_token, callbackQueryId, "Order approved. Status changed to Processing.");
    await editCaption(
      config.bot_token,
      chatId,
      messageId,
      `ORDER APPROVED\n\nTracking ID: ${trackingId}\nService: ${serviceTitle || "SMM Service"}\nCustomer: ${order.customer_email}\nAmount: PHP ${Number(order.amount).toFixed(2)}\nStatus: Processing\n\nApproved via Telegram by Admin.`
    );
  } else {
    await answerCallback(config.bot_token, callbackQueryId, "Order rejected.");
    await editCaption(
      config.bot_token,
      chatId,
      messageId,
      `ORDER REJECTED\n\nTracking ID: ${trackingId}\nService: ${serviceTitle || "SMM Service"}\nCustomer: ${order.customer_email}\nAmount: PHP ${Number(order.amount).toFixed(2)}\nStatus: Rejected\n\nRejected via Telegram by Admin.`
    );
  }

  await removeButtons(config.bot_token, chatId, messageId);
}

async function answerCallback(botToken: string, callbackQueryId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text, show_alert: true }),
  });
}

async function editCaption(botToken: string, chatId: number, messageId: number, caption: string) {
  await fetch(`https://api.telegram.org/bot${botToken}/editMessageCaption`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, caption }),
  });
}

async function removeButtons(botToken: string, chatId: number, messageId: number) {
  await fetch(`https://api.telegram.org/bot${botToken}/editMessageReplyMarkup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } }),
  });
}
