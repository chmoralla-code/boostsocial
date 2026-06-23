import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { createClient } from "@supabase/supabase-js";

const SETTINGS_KEY = "auto_cleanup";

const DEFAULT_SETTINGS = {
  auto_cleanup_enabled: false,
  order_retention_hours: 24,
  topup_retention_hours: 24,
};

function getErrorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

async function checkAdminAuth() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email?.endsWith("@boostsocial.com")) {
    return { authenticated: false as const, supabase: null as never };
  }
  return { authenticated: true as const, supabase };
}

export async function GET() {
  try {
    const auth = await checkAdminAuth();
    if (!auth.authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Server credentials missing" }, { status: 500 });
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    const { data: settings } = await serviceClient
      .from("settings")
      .select("value")
      .eq("key", SETTINGS_KEY)
      .single();

    const [completedOrders, approvedTopups, totalOrders, totalTopups] = await Promise.all([
      serviceClient.from("orders").select("id", { count: "exact", head: true }).in("status", ["Completed"]),
      serviceClient.from("topups").select("id", { count: "exact", head: true }).in("status", ["approved", "Approved"]),
      serviceClient.from("orders").select("id", { count: "exact", head: true }),
      serviceClient.from("topups").select("id", { count: "exact", head: true }),
    ]);

    const saved = settings?.value || {};
    const config = { ...DEFAULT_SETTINGS, ...saved };

    return NextResponse.json({
      success: true,
      config,
      counts: {
        completedOrders: completedOrders.count ?? 0,
        approvedTopups: approvedTopups.count ?? 0,
        totalOrders: totalOrders.count ?? 0,
        totalTopups: totalTopups.count ?? 0,
      },
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await checkAdminAuth();
    if (!auth.authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Server credentials missing" }, { status: 500 });
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    const body = await request.json();
    const config = { ...DEFAULT_SETTINGS, ...body };

    const { error } = await serviceClient
      .from("settings")
      .upsert(
        { key: SETTINGS_KEY, value: config, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );

    if (error) throw error;

    return NextResponse.json({ success: true, config });
  } catch (err: unknown) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
