import type { SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { syncBackupAdminClients } from "@/utils/supabase/dual-db";
import { getEnv } from "@/utils/env";

const VAPID_SETTINGS_KEY = "web_push_vapid_keys";
const DEFAULT_VAPID_SUBJECT = "mailto:support@pinoyboosting.com";

export const ORDER_PUSH_STATUSES = new Set(["Processing", "Completed", "Rejected", "Cancelled", "Canceled"]);

type StoredVapidKeys = {
  publicKey?: string;
  privateKey?: string;
  subject?: string;
};

type PushSubscriptionRow = {
  id: string;
  email: string;
  endpoint: string;
  subscription: webpush.PushSubscription;
};

function isUsableKeys(value: StoredVapidKeys | null | undefined): value is Required<StoredVapidKeys> {
  return Boolean(value?.publicKey && value.privateKey && value.subject);
}

function getEnvKeys(): Required<StoredVapidKeys> | null {
  const publicKey = getEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY");
  const privateKey = getEnv("VAPID_PRIVATE_KEY");
  const subject = getEnv("VAPID_SUBJECT") || DEFAULT_VAPID_SUBJECT;
  return publicKey && privateKey ? { publicKey, privateKey, subject } : null;
}

export async function getVapidKeys(client: SupabaseClient): Promise<Required<StoredVapidKeys> | null> {
  const envKeys = getEnvKeys();
  if (envKeys) return envKeys;

  try {
    const { data } = await client
      .from("settings")
      .select("value")
      .eq("key", VAPID_SETTINGS_KEY)
      .maybeSingle();

    const stored = data?.value as StoredVapidKeys | null | undefined;
    if (isUsableKeys(stored)) {
      return stored;
    }

    const generated = webpush.generateVAPIDKeys();
    const nextKeys: Required<StoredVapidKeys> = {
      publicKey: generated.publicKey,
      privateKey: generated.privateKey,
      subject: DEFAULT_VAPID_SUBJECT,
    };

    const payload = {
      key: VAPID_SETTINGS_KEY,
      value: nextKeys,
      updated_at: new Date().toISOString(),
    };

    const { error } = await client.from("settings").upsert(payload);
    if (error) {
      console.error("Web Push VAPID key storage failed:", error);
      return null;
    }

    await syncBackupAdminClients(async (backupClient) => {
      return backupClient.from("settings").upsert(payload);
    }, "web push VAPID key sync");

    return nextKeys;
  } catch (error) {
    console.error("Web Push VAPID key lookup failed:", error);
    return null;
  }
}

export async function getVapidPublicKey(client: SupabaseClient) {
  const keys = await getVapidKeys(client);
  return keys?.publicKey || "";
}

async function configureWebPush(client: SupabaseClient) {
  const keys = await getVapidKeys(client);
  if (!keys) return false;

  webpush.setVapidDetails(keys.subject, keys.publicKey, keys.privateKey);
  return true;
}

export function isOrderPushStatus(status: string) {
  return ORDER_PUSH_STATUSES.has(status);
}

export async function sendOrderStatusPush(args: {
  client: SupabaseClient;
  email?: string | null;
  trackingId: string;
  status: string;
}) {
  const normalizedEmail = args.email?.trim().toLowerCase();
  if (!normalizedEmail || !isOrderPushStatus(args.status)) return;

  const configured = await configureWebPush(args.client);
  if (!configured) return;

  const { data, error } = await args.client
    .from("push_subscriptions")
    .select("id,email,endpoint,subscription")
    .eq("email", normalizedEmail);

  if (error) {
    console.error("Push subscription lookup failed:", error);
    return;
  }

  const rows = Array.isArray(data) ? (data as PushSubscriptionRow[]) : [];
  if (rows.length === 0) return;

  const title = `PinoyBoosting order ${args.status}`;
  const body = `Your order ${args.trackingId} is now ${args.status}.`;
  const payload = JSON.stringify({
    title,
    body,
    tag: `order-${args.trackingId}`,
    url: `/app/orders?order=${encodeURIComponent(args.trackingId)}`,
    icon: "/icon.svg",
    badge: "/icon.svg",
  });

  await Promise.all(rows.map(async (row) => {
    try {
      await webpush.sendNotification(row.subscription, payload);
    } catch (error: unknown) {
      const statusCode = typeof error === "object" && error && "statusCode" in error
        ? Number((error as { statusCode?: number }).statusCode)
        : 0;

      if (statusCode === 404 || statusCode === 410) {
        await args.client.from("push_subscriptions").delete().eq("id", row.id);
        return;
      }

      console.error("Web Push notification failed:", error);
    }
  }));
}
