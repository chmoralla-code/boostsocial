import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { sendLowBalanceEmail } from "@/lib/approvalEmails";
import { notifyCustomer } from "@/lib/customerNotifications";

const CRON_SECRET = process.env.CRON_SECRET;
const SETTINGS_KEY = "customer_alerts";

const DEFAULT_ALERT_SETTINGS = {
  lowBalanceThreshold: 100,
  minDaysBetweenAlerts: 7,
  enabled: true,
};

type AlertSettings = {
  lowBalanceThreshold: number;
  minDaysBetweenAlerts: number;
  enabled: boolean;
};

type AdminClient = SupabaseClient; // service-role client with default generics

export function normalizeCustomerAlertSettings(value: unknown): AlertSettings {
  const config = (value || {}) as Record<string, unknown>;
  return {
    lowBalanceThreshold: typeof config.lowBalanceThreshold === "number"
      ? config.lowBalanceThreshold
      : DEFAULT_ALERT_SETTINGS.lowBalanceThreshold,
    minDaysBetweenAlerts: typeof config.minDaysBetweenAlerts === "number"
      ? config.minDaysBetweenAlerts
      : DEFAULT_ALERT_SETTINGS.minDaysBetweenAlerts,
    enabled: config.enabled === undefined ? true : Boolean(config.enabled),
  };
}

async function loadAlertSettings(supabase: AdminClient) {
  try {
    const { data } = await supabase
      .from("settings")
      .select("value")
      .eq("key", SETTINGS_KEY)
      .maybeSingle();
    return normalizeCustomerAlertSettings(data?.value);
  } catch {
    return { ...DEFAULT_ALERT_SETTINGS };
  }
}

export async function GET(request: Request) {
  try {
    if (!CRON_SECRET) {
      return NextResponse.json(
        { error: "Cron secret is not configured. Set CRON_SECRET in Vercel env vars." },
        { status: 503 }
      );
    }

    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Server credentials missing" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const settings = await loadAlertSettings(supabase);

    if (!settings.enabled) {
      return NextResponse.json({ success: true, alerted: 0, message: "Low-balance alerts are disabled in admin settings." });
    }

    const threshold = settings.lowBalanceThreshold;
    const minDays = settings.minDaysBetweenAlerts;
    const cutoff = new Date(Date.now() - minDays * 24 * 60 * 60 * 1000).toISOString();

    // Profiles with a low balance that haven't been alerted within the cooldown.
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email, balance, last_low_balance_alert_at")
      .lt("balance", threshold)
      .or(`last_low_balance_alert_at.is.null,last_low_balance_alert_at.lt.${cutoff}`);

    const rows = (profiles || []) as Array<{
      id: string;
      email: string | null;
      balance: number | string | null;
      last_low_balance_alert_at?: string | null;
    }>;

    let alerted = 0;
    const results = await Promise.allSettled(
      rows.map(async (profile) => {
        if (!profile.email) return;
        const balance = Number(profile.balance ?? 0);

        await notifyCustomer({
          client: supabase,
          email: profile.email,
          message: `Your wallet balance is running low (PHP ${balance.toFixed(2)}). Top up so you never miss a boost!`,
        });

        await sendLowBalanceEmail({ email: profile.email, balance }).catch((err) => {
          console.error("Low-balance email failed:", err);
        });

        await supabase
          .from("profiles")
          .update({ last_low_balance_alert_at: new Date().toISOString() })
          .eq("id", profile.id);

        alerted++;
      })
    );

    for (const result of results) {
      if (result.status === "rejected") {
        console.error("Low-balance alert task failed:", result.reason);
      }
    }

    return NextResponse.json({
      success: true,
      alerted,
      threshold,
      minDaysBetweenAlerts: minDays,
      scanned: rows.length,
    });
  } catch (err: unknown) {
    console.error("Low-balance cron failed:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
