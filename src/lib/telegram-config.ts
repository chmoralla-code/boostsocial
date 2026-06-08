import { createClient } from "@supabase/supabase-js";
import { getEnv } from "@/utils/env";

const CONFIG_BUCKET = "receipts";
const ORDER_CONFIG_PATH = "admin-config/telegram.png";
const TOPUP_CONFIG_PATH = "admin-config/telegram-topup.png";

export type TelegramConfig = { bot_token: string; chat_id: string };

const SUPABASE_BACKUP_KEYS = [
  { urlKey: "BACKUP_SUPABASE_URL", keyKey: "BACKUP_SUPABASE_SERVICE_ROLE_KEY" },
  { urlKey: "BACKUP3_SUPABASE_URL", keyKey: "BACKUP3_SUPABASE_SERVICE_ROLE_KEY" },
  { urlKey: "BACKUP4_SUPABASE_URL", keyKey: "BACKUP4_SUPABASE_SERVICE_ROLE_KEY" },
  { urlKey: "BACKUP5_SUPABASE_URL", keyKey: "BACKUP5_SUPABASE_SERVICE_ROLE_KEY" },
];

function getEnvConfig(orderType: "order" | "topup"): TelegramConfig | null {
  if (orderType === "order") {
    const token = getEnv("TELEGRAM_ORDER_BOT_TOKEN");
    const chatId = getEnv("TELEGRAM_ORDER_CHAT_ID");
    if (token && chatId) return { bot_token: token, chat_id: chatId };
  } else {
    const token = getEnv("TELEGRAM_TOPUP_BOT_TOKEN");
    const chatId = getEnv("TELEGRAM_TOPUP_CHAT_ID");
    if (token && chatId) return { bot_token: token, chat_id: chatId };
  }
  return null;
}

async function readFromStorage(
  url: string,
  key: string,
  path: string
): Promise<TelegramConfig | null> {
  try {
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await supabase.storage.from(CONFIG_BUCKET).download(path);
    if (error || !data) return null;
    return JSON.parse(await data.text());
  } catch {
    return null;
  }
}

async function readFromPrimary(path: string): Promise<TelegramConfig | null> {
  const url = getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  return readFromStorage(url, key, path);
}

async function readFromBackups(path: string): Promise<TelegramConfig | null> {
  for (const backup of SUPABASE_BACKUP_KEYS) {
    const url = getEnv(backup.urlKey);
    const key = getEnv(backup.keyKey);
    if (!url || !key) continue;
    const config = await readFromStorage(url, key, path);
    if (config?.bot_token) return config;
  }
  return null;
}

export async function getResilientTelegramConfig(
  path: string,
  orderType: "order" | "topup"
): Promise<TelegramConfig | null> {
  const envConfig = getEnvConfig(orderType);
  if (envConfig) return envConfig;

  const primaryConfig = await readFromPrimary(path);
  if (primaryConfig?.bot_token) return primaryConfig;

  const backupConfig = await readFromBackups(path);
  if (!backupConfig) {
    console.warn(`[telegram-config] All config sources failed for path: ${path}. Set TELEGRAM_ORDER_BOT_TOKEN/TELEGRAM_ORDER_CHAT_ID or TELEGRAM_TOPUP_BOT_TOKEN/TELEGRAM_TOPUP_CHAT_ID env vars, or ensure Supabase Storage is accessible.`);
  }
  return backupConfig;
}

export async function getOrderTelegramConfig(): Promise<TelegramConfig | null> {
  return getResilientTelegramConfig(ORDER_CONFIG_PATH, "order");
}

export async function getTopupTelegramConfig(): Promise<TelegramConfig | null> {
  return getResilientTelegramConfig(TOPUP_CONFIG_PATH, "topup");
}

export async function getAnyTelegramConfig(): Promise<TelegramConfig | null> {
  return (await getTopupTelegramConfig()) || (await getOrderTelegramConfig());
}
