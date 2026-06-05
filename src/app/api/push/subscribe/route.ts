import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { syncBackupAdminClients } from "@/utils/supabase/dual-db";

type BrowserPushSubscription = {
  endpoint?: string;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
};

function isValidSubscription(value: unknown): value is BrowserPushSubscription {
  if (!value || typeof value !== "object") return false;
  const subscription = value as BrowserPushSubscription;
  return Boolean(subscription.endpoint && subscription.keys?.p256dh && subscription.keys.auth);
}

export async function POST(req: NextRequest) {
  try {
    const sessionClient = await createServerClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();

    if (!user?.id || !user.email) {
      return NextResponse.json({ error: "Please login before enabling phone notifications." }, { status: 401 });
    }

    const body = await req.json();
    const subscription = body.subscription;

    if (!isValidSubscription(subscription)) {
      return NextResponse.json({ error: "Invalid push subscription." }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Server configuration missing." }, { status: 500 });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const payload = {
      user_id: user.id,
      email: user.email.trim().toLowerCase(),
      endpoint: subscription.endpoint!,
      subscription,
      user_agent: req.headers.get("user-agent") || "",
    };

    const { error } = await admin
      .from("push_subscriptions")
      .upsert(payload, { onConflict: "endpoint" });

    if (error) {
      console.error("Push subscription save failed:", error);
      return NextResponse.json({
        error: "Phone notifications table is not ready yet. Run the latest Supabase migration.",
      }, { status: 503 });
    }

    await syncBackupAdminClients(async (backupClient) => {
      return backupClient
        .from("push_subscriptions")
        .upsert(payload, { onConflict: "endpoint" });
    }, "push subscription sync");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Push subscription endpoint failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
