import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { syncBackupAdminClients } from "@/utils/supabase/dual-db";
import { getVipPlanById } from "@/utils/vip";
import { notifyCustomer } from "@/lib/customerNotifications";

type ActionPayload = {
  subscriptionId?: string;
  action?: "approve" | "reject";
};

function formatPhp(amount: number) {
  return `PHP ${Number(amount || 0).toFixed(2)}`;
}

export async function POST(req: NextRequest) {
  try {
    const { subscriptionId, action } = (await req.json()) as ActionPayload;

    if (!subscriptionId || !action) {
      return NextResponse.json({ error: "Missing subscriptionId or action." }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Server configuration missing" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: subscription, error: subError } = await supabase
      .from("vip_subscriptions")
      .select("*")
      .eq("id", subscriptionId)
      .single();

    if (subError) throw subError;
    if (!subscription) {
      return NextResponse.json({ error: "VIP subscription request not found." }, { status: 404 });
    }

    if (subscription.status !== "pending") {
      return NextResponse.json({ error: `Subscription is already ${subscription.status}.` }, { status: 400 });
    }

    const selectedPlan = getVipPlanById(subscription.plan_code);
    if (!selectedPlan) {
      return NextResponse.json({ error: "Unknown VIP plan in subscription request." }, { status: 500 });
    }

    if (action === "approve") {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("vip_plan, vip_expires_at")
        .eq("id", subscription.user_id)
        .single();

      if (profileError) throw profileError;

      const now = new Date();
      const startAt = new Date(subscription.created_at || now).getTime();
      const baseStart = profile?.vip_expires_at
        ? Math.max(new Date(profile.vip_expires_at).getTime(), startAt)
        : startAt;

      const expiresAt = new Date(baseStart);
      expiresAt.setDate(expiresAt.getDate() + selectedPlan.durationDays);

      const { error: profileUpdateError } = await supabase
        .from("profiles")
        .update({
          vip_plan: selectedPlan.id,
          vip_started_at: new Date(baseStart).toISOString(),
          vip_expires_at: expiresAt.toISOString(),
        })
        .eq("id", subscription.user_id);

      if (profileUpdateError) throw profileUpdateError;

      const { error: subUpdateError } = await supabase
        .from("vip_subscriptions")
        .update({
          status: "approved",
          reviewed_at: new Date().toISOString(),
          reviewed_by: "admin",
        })
        .eq("id", subscriptionId);

      if (subUpdateError) throw subUpdateError;

      await syncBackupAdminClients(async (backupClient) => {
        await backupClient
          .from("profiles")
          .update({
            vip_plan: selectedPlan.id,
            vip_started_at: new Date(baseStart).toISOString(),
            vip_expires_at: expiresAt.toISOString(),
          })
          .eq("id", subscription.user_id);

        await backupClient
          .from("vip_subscriptions")
          .update({
            status: "approved",
            reviewed_at: new Date().toISOString(),
            reviewed_by: "admin",
          })
          .eq("id", subscriptionId);
      }, "vip subscription approval sync");

      notifyCustomer({
        client: supabase,
        email: subscription.email,
        message: `VIP ${selectedPlan.label} has been approved. Your account is now active until ${expiresAt.toLocaleDateString("en-PH")} for ${selectedPlan.durationDays} days.`,
      }).catch((err) => {
        console.error("VIP approval customer notification failed:", err);
      });

      return NextResponse.json({
        success: true,
        vip_plan: selectedPlan.id,
        vip_expires_at: expiresAt.toISOString(),
      });
    }

    if (action === "reject") {
      const { error: subUpdateError } = await supabase
        .from("vip_subscriptions")
        .update({
          status: "rejected",
          reviewed_at: new Date().toISOString(),
          reviewed_by: "admin",
        })
        .eq("id", subscriptionId);

      if (subUpdateError) throw subUpdateError;

      await syncBackupAdminClients(async (backupClient) => {
        await backupClient
          .from("vip_subscriptions")
          .update({
            status: "rejected",
            reviewed_at: new Date().toISOString(),
            reviewed_by: "admin",
          })
          .eq("id", subscriptionId);
      }, "vip subscription rejection sync");

      notifyCustomer({
        client: supabase,
        email: subscription.email,
        message: `Your VIP ${selectedPlan.label} request for ${formatPhp(subscription.amount)} was rejected. Please upload the correct payment screenshot and submit a new request.`,
      }).catch((err) => {
        console.error("VIP rejection customer notification failed:", err);
      });

      return NextResponse.json({ success: true, status: "rejected" });
    }

    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown server error.";
    console.error("Approve VIP subscription failed:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
