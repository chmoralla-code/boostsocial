import { SupabaseClient } from "@supabase/supabase-js";
import { sendAdminAlert } from "@/lib/telegram";

const ALERT_SETTINGS_KEY = "rixeysmm_low_balance_alert";
const DEFAULT_LOW_BALANCE_THRESHOLD = 100;
const ALERT_COOLDOWN_MS = 6 * 60 * 60 * 1000;

let memoryLastAlertAt = 0;

function getThreshold() {
  const configured = Number(process.env.RIXEYSMM_LOW_BALANCE_THRESHOLD || DEFAULT_LOW_BALANCE_THRESHOLD);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_LOW_BALANCE_THRESHOLD;
}

export async function notifyLowProviderBalanceIfNeeded(client: SupabaseClient, balance: number) {
  const threshold = getThreshold();
  if (!Number.isFinite(balance) || balance > threshold) return;

  const now = Date.now();
  let lastAlertAt = memoryLastAlertAt;

  try {
    const { data } = await client
      .from("settings")
      .select("value")
      .eq("key", ALERT_SETTINGS_KEY)
      .maybeSingle();

    const value = data?.value as { lastAlertAt?: string | number } | null | undefined;
    if (value?.lastAlertAt) {
      lastAlertAt = new Date(value.lastAlertAt).getTime();
    }
  } catch (error) {
    console.error("Provider balance alert settings lookup failed:", error);
  }

  if (lastAlertAt && now - lastAlertAt < ALERT_COOLDOWN_MS) return;

  await sendAdminAlert({
    title: "LOW RIXEYSMM BALANCE ALERT",
    message: `Provider balance is PHP ${balance.toFixed(2)}. Top up RixeySMM soon so approved orders do not get stuck. Alert threshold: PHP ${threshold.toFixed(2)}.`,
  });

  memoryLastAlertAt = now;

  try {
    await client
      .from("settings")
      .upsert({
        key: ALERT_SETTINGS_KEY,
        value: { lastAlertAt: new Date(now).toISOString(), balance, threshold },
        updated_at: new Date(now).toISOString(),
      });
  } catch (error) {
    console.error("Provider balance alert settings update failed:", error);
  }
}
