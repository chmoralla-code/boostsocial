import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { autoPlaceRixeyOrder } from "@/lib/rixeysmm";
import { syncBackupAdminClients } from "@/utils/supabase/dual-db";
import { enforceRateLimit } from "@/utils/security/rate-limit";
import { getOrderTelegramConfig, getTopupTelegramConfig } from "@/lib/telegram-config";
import type { TelegramConfig } from "@/lib/telegram-config";

const CONFIG_BUCKET = "receipts";
import { creditReferralCommission } from "@/utils/referrals";
import { resolveSmmServiceTitle } from "@/lib/smmServiceResolver";
import { notifyCustomer, notifyOrderStatusCustomer } from "@/lib/customerNotifications";


type JoinedService = { title?: string | null } | { title?: string | null }[] | null | undefined;

function getJoinedServiceTitle(services: JoinedService) {
  return Array.isArray(services) ? services[0]?.title : services?.title;
}

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
  return await getTopupTelegramConfig() || await getOrderTelegramConfig();
}

async function getOrderActionConfigs() {
  const configs = [
    await getTopupTelegramConfig(),
    await getOrderTelegramConfig(),
  ].filter((config): config is TelegramConfig => Boolean(config?.bot_token));

  return configs.filter((config, index, all) =>
    all.findIndex((item) => item.bot_token === config.bot_token) === index
  );
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
  } catch (err: unknown) {
    console.error("Telegram webhook error:", err);
    return NextResponse.json({ ok: true });
  }
}

async function handleTopupAction(callbackData: string, chatId: number, messageId: number, callbackQueryId: string) {
  const config = await getTopupTelegramConfig();
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

    try {
      await creditReferralCommission({
        primaryClient: supabase,
        customerId: topup.user_id,
        source: "topup",
        amount: topupAmount,
        referenceId: topupId,
      });
    } catch (commissionError) {
      console.error("Telegram top-up referral commission failed:", commissionError);
    }

    await answerCallback(config.bot_token, callbackQueryId, `Approved! PHP ${topupAmount.toFixed(2)} credited.`);
    notifyCustomer({
      client: supabase,
      email: topup.email,
      message: `System update: Your PHP ${topupAmount.toFixed(2)} wallet top-up was approved and credited. New balance: PHP ${newBalance.toFixed(2)}.`,
    }).catch((notificationErr) => {
      console.error("Telegram top-up approval customer notification failed:", notificationErr);
    });
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
    notifyCustomer({
      client: supabase,
      email: topup.email,
      message: `System update: Your PHP ${Number(topup.amount).toFixed(2)} wallet top-up was rejected. Please contact support if the receipt or amount needs correction.`,
    }).catch((notificationErr) => {
      console.error("Telegram top-up rejection customer notification failed:", notificationErr);
    });
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
  const configs = await getOrderActionConfigs();
  const config = configs[0] || await getOrderActionConfig();
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
      smm_service_id,
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
    await answerWithOrderBots(configs, callbackQueryId, `Already ${order.status}.`);
    await removeButtonsWithOrderBots(configs, chatId, messageId);
    return;
  }

  const paymentMethod = String(order.payment_method || "").trim();
  const isWalletPayment = paymentMethod.toLowerCase() === "wallet";

  if (isApprove && isWalletPayment) {
    await answerWithOrderBots(configs, callbackQueryId, "Wallet orders do not need Telegram receipt approval.");
    await removeButtonsWithOrderBots(configs, chatId, messageId);
    return;
  }

  if (isApprove) {
    const hasReceipt = await hasUploadedOrderReceipt(supabase, orderId);
    if (!hasReceipt) {
      await answerWithOrderBots(configs, callbackQueryId, "Receipt proof not found. Upload proof before approving.");
      return;
    }
  }

  const newStatus = isApprove ? "Processing" : "Rejected";
  const { data: updatedOrder, error: updateError } = await supabase
    .from("orders")
    .update({ status: newStatus })
    .eq("id", orderId)
    .eq("status", "Pending")
    .select("id")
    .maybeSingle();

  if (updateError) {
    await answerWithOrderBots(configs, callbackQueryId, `Failed to update order: ${updateError.message}`);
    return;
  }

  if (!updatedOrder) {
    await answerWithOrderBots(configs, callbackQueryId, "Order was already updated by another admin.");
    await removeButtonsWithOrderBots(configs, chatId, messageId);
    return;
  }

  await syncBackupAdminClients(async (backupClient) => {
    await backupClient
      .from("orders")
      .update({ status: newStatus })
      .eq("id", orderId);
  }, "telegram order status sync");

  const serviceTitle = getJoinedServiceTitle(order.services);
  const resolvedServiceTitle = await resolveSmmServiceTitle(order.smm_service_id, serviceTitle || "SMM Service");
  const trackingId = `BS-${orderId.slice(0, 8).toUpperCase()}`;

  notifyOrderStatusCustomer({
    client: supabase,
    email: order.customer_email,
    trackingId,
    status: newStatus,
  }).catch((notificationErr) => {
    console.error("Telegram order status customer notification failed:", notificationErr);
  });

  if (isApprove) {
    try {
      await creditReferralCommission({
        primaryClient: supabase,
        customerEmail: order.customer_email,
        source: "order",
        amount: Number(order.amount),
        referenceId: orderId,
      });
    } catch (commissionError) {
      console.error("Telegram order referral commission failed:", commissionError);
    }

    if (!order.external_order_id) {
      autoPlaceRixeyOrder(orderId, order.service_id, order.target_url, order.quantity).catch((err) => {
        console.error("Async auto-placement on RixeySMM from Telegram approval failed:", err);
      });
    }

    await answerWithOrderBots(configs, callbackQueryId, "Order approved. Status changed to Processing.");
    await editCaptionWithOrderBots(
      configs,
      chatId,
      messageId,
      `ORDER APPROVED\n\nTracking ID: ${trackingId}\nService: ${resolvedServiceTitle}\nCustomer: ${order.customer_email}\nQuantity: ${Number(order.quantity || 0).toLocaleString()}\nAmount: PHP ${Number(order.amount).toFixed(2)}\nPayment: ${paymentMethod || "GCash"}\nStatus: Processing\n\nApproved via Telegram by Admin.`
    );
  } else {
    await answerWithOrderBots(configs, callbackQueryId, "Order rejected.");
    await editCaptionWithOrderBots(
      configs,
      chatId,
      messageId,
      `ORDER REJECTED\n\nTracking ID: ${trackingId}\nService: ${resolvedServiceTitle}\nCustomer: ${order.customer_email}\nQuantity: ${Number(order.quantity || 0).toLocaleString()}\nAmount: PHP ${Number(order.amount).toFixed(2)}\nPayment: ${paymentMethod || "GCash"}\nStatus: Rejected\n\nRejected via Telegram by Admin.`
    );
  }

  await removeButtonsWithOrderBots(configs, chatId, messageId);
}

async function hasUploadedOrderReceipt(supabase: ReturnType<typeof getSupabase>, orderId: string) {
  const { data, error } = await supabase.storage
    .from(CONFIG_BUCKET)
    .list("", { limit: 1000, search: orderId });

  if (error) {
    console.error("Telegram order receipt lookup failed:", error);
    return false;
  }

  return Boolean(data?.some((file) => file.name.startsWith(`${orderId}_`) || file.name.startsWith(orderId)));
}

async function answerWithOrderBots(configs: TelegramConfig[], callbackQueryId: string, text: string) {
  for (const config of configs) {
    if (await answerCallback(config.bot_token, callbackQueryId, text)) return;
  }
}

async function editCaptionWithOrderBots(configs: TelegramConfig[], chatId: number, messageId: number, caption: string) {
  for (const config of configs) {
    if (await editCaption(config.bot_token, chatId, messageId, caption)) return;
  }
}

async function removeButtonsWithOrderBots(configs: TelegramConfig[], chatId: number, messageId: number) {
  for (const config of configs) {
    if (await removeButtons(config.bot_token, chatId, messageId)) return;
  }
}

async function answerCallback(botToken: string, callbackQueryId: string, text: string) {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text, show_alert: true }),
  });
  const data = await res.json().catch(() => null);
  return Boolean(data?.ok ?? res.ok);
}

async function editCaption(botToken: string, chatId: number, messageId: number, caption: string) {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/editMessageCaption`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, caption }),
  });
  const data = await res.json().catch(() => null);
  return Boolean(data?.ok ?? res.ok);
}

async function removeButtons(botToken: string, chatId: number, messageId: number) {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/editMessageReplyMarkup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } }),
  });
  const data = await res.json().catch(() => null);
  return Boolean(data?.ok ?? res.ok);
}
