import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { syncBackupAdminClients } from "@/utils/supabase/dual-db";
import { normalizeCustomerAlertSettings } from "@/app/api/cron/check-balances/route";

const SETTINGS_KEY = "customer_alerts";

function getErrorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

async function checkAdminAuth() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email?.endsWith("@boostsocial.com")) {
    return { authenticated: false, supabase: null };
  }

  return { authenticated: true, supabase };
}

export async function GET() {
  try {
    const { authenticated, supabase } = await checkAdminAuth();
    if (!authenticated || !supabase) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data } = await supabase
      .from("settings")
      .select("value")
      .eq("key", SETTINGS_KEY)
      .maybeSingle();

    return NextResponse.json(normalizeCustomerAlertSettings(data?.value));
  } catch (err: unknown) {
    console.error("GET customer alerts settings error:", err);
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { authenticated, supabase } = await checkAdminAuth();
    if (!authenticated || !supabase) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const settings = normalizeCustomerAlertSettings({
      lowBalanceThreshold: Number(body.lowBalanceThreshold),
      minDaysBetweenAlerts: Number(body.minDaysBetweenAlerts),
      enabled: body.enabled === undefined ? true : Boolean(body.enabled),
    });

    const now = new Date().toISOString();
    const valueObj = {
      ...settings,
      lowBalanceThreshold: Math.max(0, settings.lowBalanceThreshold),
      minDaysBetweenAlerts: Math.max(1, settings.minDaysBetweenAlerts),
    };

    const { error } = await supabase
      .from("settings")
      .upsert({ key: SETTINGS_KEY, value: valueObj, updated_at: now }, { onConflict: "key" });
    if (error) throw error;

    await syncBackupAdminClients(async (backupClient) => {
      await backupClient
        .from("settings")
        .upsert({ key: SETTINGS_KEY, value: valueObj, updated_at: now }, { onConflict: "key" });
    }, "customer alerts settings sync");

    return NextResponse.json({ success: true, ...valueObj });
  } catch (err: unknown) {
    console.error("POST customer alerts settings error:", err);
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
