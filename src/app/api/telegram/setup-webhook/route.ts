import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { isAdminEmail } from "@/utils/security/admin";
import { enforceRateLimit } from "@/utils/security/rate-limit";
import { getOrderTelegramConfig, getTopupTelegramConfig } from "@/lib/telegram-config";
import type { TelegramConfig } from "@/lib/telegram-config";

const CONFIG_BUCKET = "receipts";



async function requireAdmin(req: NextRequest) {
  const configuredSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  const receivedSecret = req.headers.get("x-telegram-setup-secret")?.trim();

  if (configuredSecret && receivedSecret && receivedSecret === configuredSecret) {
    return null;
  }

  const sessionClient = await createServerClient();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();

  if (!user?.email || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}



async function setWebhook(botToken: string, webhookUrl: string, secretToken: string) {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: secretToken,
      allowed_updates: ["callback_query"],
      drop_pending_updates: true
    }),
  });

  return res.json();
}

export async function POST(req: NextRequest) {
  try {
    const adminResponse = await requireAdmin(req);
    if (adminResponse) return adminResponse;

    const rateLimitResponse = enforceRateLimit(req, {
      key: "telegram-setup-webhook-post",
      maxRequests: 10,
      windowMs: 60_000,
    });
    if (rateLimitResponse) return rateLimitResponse;

    const { webhookUrl } = await req.json();

    if (!webhookUrl) {
      return NextResponse.json({ error: "webhookUrl is required" }, { status: 400 });
    }

    let parsedWebhookUrl: URL;
    try {
      parsedWebhookUrl = new URL(String(webhookUrl));
    } catch {
      return NextResponse.json({ error: "Invalid webhook URL." }, { status: 400 });
    }

    if (parsedWebhookUrl.protocol !== "https:") {
      return NextResponse.json({ error: "Webhook URL must use HTTPS." }, { status: 400 });
    }

    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
    if (!webhookSecret) {
      return NextResponse.json({ error: "TELEGRAM_WEBHOOK_SECRET is not configured on the server." }, { status: 500 });
    }

    const configs = [
      { name: "Order bot", config: await getOrderTelegramConfig() },
      { name: "Top-up bot", config: await getTopupTelegramConfig() },
    ].filter((item) => item.config?.bot_token);

    if (configs.length === 0) {
      return NextResponse.json({ error: "Telegram bot not configured. Set bot token and chat ID in admin settings first." }, { status: 400 });
    }

    const results = [];
    for (const item of configs) {
      const result = await setWebhook(item.config!.bot_token!, parsedWebhookUrl.toString(), webhookSecret);
      results.push({ name: item.name, result });
    }

    const failed = results.find((item) => !item.result.ok);
    if (failed) {
      return NextResponse.json({ error: `${failed.name}: ${failed.result.description || "Failed to set webhook"}` }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      description: `Webhook registered for ${results.map((item) => item.name).join(" and ")}.`
    });
  } catch (err: any) {
    console.error("Setup webhook error:", err);
    return NextResponse.json({ error: err.message || err.toString() }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const adminResponse = await requireAdmin(req);
    if (adminResponse) return adminResponse;

    const topupConfig = await getTopupTelegramConfig();
    const orderConfig = await getOrderTelegramConfig();
    const config = topupConfig?.bot_token ? topupConfig : orderConfig;

    if (!config?.bot_token) {
      return NextResponse.json({ error: "Telegram not configured" }, { status: 400 });
    }

    const res = await fetch(`https://api.telegram.org/bot${config.bot_token}/getWebhookInfo`);
    const result = await res.json();

    return NextResponse.json(result.result || result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
