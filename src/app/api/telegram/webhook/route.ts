import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { autoPlaceRixeyOrder } from "@/lib/rixeysmm";
import { syncBackupAdminClients, fallbackRead } from "@/utils/supabase/dual-db";
import { enforceRateLimit } from "@/utils/security/rate-limit";
import { creditReferralCommission } from "@/utils/referrals";
import { resolveSmmServiceTitle } from "@/lib/smmServiceResolver";
import { notifyCustomer, notifyOrderStatusCustomer } from "@/lib/customerNotifications";

type TelegramConfig = { bot_token: string; chat_id: string };
type JoinedService = { title?: string | null } | { title?: string | null }[] | null | undefined;
const CONFIG_BUCKET = "receipts";
type TopupApprovalRow = {
  user_id: string;
  email: string;
  amount: number | string;
  new_balance: number | string;
};

function getJoinedServiceTitle(services: JoinedService) {
  return Array.isArray(services) ? services[0]?.title : services?.title;
}

const getSupabase = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

async function getTelegramConfig(type: "order" | "topup"): Promise<TelegramConfig | null> {
  try {
    const key = type === "order" ? "telegram_order_config" : "telegram_topup_config";
    const { data } = await fallbackRead(async (db) => {
      return db.from("settings").select("value").eq("key", key).single();
    });
    if (data?.value) {
      return {
        bot_token: data.value.bot_token || "",
        chat_id: data.value.chat_id || "",
      };
    }
    return null;
  } catch {
    return null;
  }
}

async function getOrderActionConfig() {
  return await getTelegramConfig("topup") || await getTelegramConfig("order");
}

async function getAllActionConfigs() {
  const configs = [
    await getTelegramConfig("topup"),
    await getTelegramConfig("order"),
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
  const configs = await getAllActionConfigs();
  if (configs.length === 0) return;

  const isApprove = callbackData.startsWith("topup_approve_");
  const topupId = callbackData.replace("topup_approve_", "").replace("topup_reject_", "");
  const supabase = getSupabase();

  const { data: topup, error: topupError } = await fallbackRead(async (db) => {
    return db
      .from("topups")
      .select("*")
      .eq("id", topupId)
      .single();
  });

  if (topupError || !topup) {
    await answerWithOrderBots(configs, callbackQueryId, "Top-up not found.");
    return;
  }

  if (topup.status !== "pending") {
    await answerWithOrderBots(configs, callbackQueryId, `Already ${topup.status}.`);
    await removeButtonsWithOrderBots(configs, chatId, messageId);
    return;
  }

  if (isApprove) {
    const topupAmount = Number(topup.amount);
    const { data: approvalRows, error: approvalError } = await supabase.rpc("approve_topup_atomic", {
      p_topup_id: topupId,
      p_amount: topupAmount,
      p_reviewed_by: "telegram",
    });

    if (approvalError) {
      await answerWithOrderBots(configs, callbackQueryId, approvalError.message || "Top-up approval failed.");
      return;
    }

    const approval = Array.isArray(approvalRows)
      ? approvalRows[0] as TopupApprovalRow | undefined
      : approvalRows as TopupApprovalRow | undefined;

    if (!approval) {
      await answerWithOrderBots(configs, callbackQueryId, "Top-up approval did not complete.");
      return;
    }

    const newBalance = Number(approval.new_balance);

    await syncBackupAdminClients(async (db) => {
      await db
        .from("profiles")
        .update({ balance: newBalance })
        .eq("id", approval.user_id);

      await db
        .from("topups")
        .update({ status: "approved", amount: Number(approval.amount) })
        .eq("id", topupId);
    }, "telegram topup approval sync");

    try {
      await creditReferralCommission({
        primaryClient: supabase,
        customerId: approval.user_id,
        source: "topup",
        amount: Number(approval.amount),
        referenceId: topupId,
      });
    } catch (commissionError) {
      console.error("Telegram top-up referral commission failed:", commissionError);
    }

    await answerWithOrderBots(configs, callbackQueryId, `Approved! PHP ${Number(approval.amount).toFixed(2)} credited.`);
    notifyCustomer({
      client: supabase,
      email: approval.email || topup.email,
      message: `System update: Your PHP ${Number(approval.amount).toFixed(2)} wallet top-up was approved and credited. New balance: PHP ${newBalance.toFixed(2)}.`,
    }).catch((notificationErr) => {
      console.error("Telegram top-up approval customer notification failed:", notificationErr);
    });
    await editCaptionWithOrderBots(
      configs,
      chatId,
      messageId,
      `TOP-UP APPROVED\n\nCustomer: ${approval.email || topup.email}\nAmount: PHP ${Number(approval.amount).toFixed(2)}\nNew Balance: PHP ${newBalance.toFixed(2)}\n\nApproved via Telegram by Admin.`
    );
  } else {
    await syncBackupAdminClients(async (db) => {
      await db
        .from("topups")
        .update({ status: "rejected" })
        .eq("id", topupId);
    }, "telegram topup rejection sync");

    await answerWithOrderBots(configs, callbackQueryId, "Top-up rejected.");
    notifyCustomer({
      client: supabase,
      email: topup.email,
      message: `System update: Your PHP ${Number(topup.amount).toFixed(2)} wallet top-up was rejected. Please contact support if the receipt or amount needs correction.`,
    }).catch((notificationErr) => {
      console.error("Telegram top-up rejection customer notification failed:", notificationErr);
    });
    await editCaptionWithOrderBots(
      configs,
      chatId,
      messageId,
      `TOP-UP REJECTED\n\nCustomer: ${topup.email}\nAmount: PHP ${Number(topup.amount).toFixed(2)}\n\nRejected via Telegram by Admin.`
    );
  }

  await removeButtonsWithOrderBots(configs, chatId, messageId);
}

async function handleOrderAction(callbackData: string, chatId: number, messageId: number, callbackQueryId: string) {
  const configs = await getAllActionConfigs();
  const config = configs[0] || await getOrderActionConfig();
  if (!config?.bot_token) return;

  const isApprove = callbackData.startsWith("order_approve_");
  const orderId = callbackData.replace("order_approve_", "").replace("order_reject_", "");
  const supabase = getSupabase();

  const { data: order, error: orderError } = await fallbackRead(async (db) => {
    return db
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
  });

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
  let updateError = null;
  let updatedOrder = null;

  try {
    await syncBackupAdminClients(async (db) => {
      const { data, error } = await db
        .from("orders")
        .update({ status: newStatus })
        .eq("id", orderId)
        .eq("status", "Pending")
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (data) updatedOrder = data;
    }, "telegram order status sync");
  } catch (err: any) {
    updateError = err;
  }

  if (updateError) {
    await answerWithOrderBots(configs, callbackQueryId, `Failed to update order: ${updateError.message || updateError}`);
    return;
  }

  if (!updatedOrder) {
    await answerWithOrderBots(configs, callbackQueryId, "Order was already updated by another admin.");
    await removeButtonsWithOrderBots(configs, chatId, messageId);
    return;
  }

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
  try {
    const { data: order } = await supabase
      .from("orders")
      .select("receipt_url")
      .eq("id", orderId)
      .maybeSingle();

    if (order?.receipt_url) return true;
  } catch (error) {
    console.error("Telegram order receipt DB lookup failed:", error);
  }

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
