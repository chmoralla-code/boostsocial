import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { enforceRateLimit } from "@/utils/security/rate-limit";
import { getSupabaseServiceRoleKey, getSupabaseUrl } from "@/utils/env";
import { syncBackupAdminClients } from "@/utils/supabase/dual-db";
import { notifyCustomer } from "@/lib/customerNotifications";
import { sendCheckInEmail } from "@/lib/approvalEmails";

const SETTINGS_KEY = "customer_alerts";
const DEFAULT_REWARD = 5;

function getErrorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

async function loadRewardAmount(supabase: SupabaseClient) {
  try {
    const { data } = await supabase
      .from("settings")
      .select("value")
      .eq("key", SETTINGS_KEY)
      .maybeSingle();
    const reward = Number((data?.value as { rewardAmount?: number } | null)?.rewardAmount ?? DEFAULT_REWARD);
    return Number.isFinite(reward) && reward > 0 ? reward : DEFAULT_REWARD;
  } catch {
    return DEFAULT_REWARD;
  }
}

/**
 * Daily check-in bonus: credits the wallet atomically, once per user per day
 * (enforced by the UNIQUE(user_id, checkin_date) constraint + ON CONFLICT).
 */
export async function POST(req: NextRequest) {
  try {
    const rateLimitResponse = enforceRateLimit(req, {
      key: "checkin",
      maxRequests: 5,
      windowMs: 60_000,
    });
    if (rateLimitResponse) return rateLimitResponse;

    const sessionClient = await createServerClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();
    if (!user?.id || !user.email) {
      return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
    }

    const supabase = createClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
      auth: { persistSession: false },
    });

    const reward = await loadRewardAmount(supabase);

    // 1. Claim today's check-in (idempotent — ON CONFLICT DO NOTHING).
    const { data: inserted, error: checkinErr } = await supabase
      .from("daily_checkins")
      .insert({ user_id: user.id, reward, checkin_date: new Date().toISOString().slice(0, 10) })
      .select("id")
      .maybeSingle();

    if (checkinErr && /duplicate|unique/i.test(checkinErr.message || "")) {
      return NextResponse.json({ error: "You already checked in today", code: "ALREADY_CHECKED_IN" }, { status: 409 });
    }
    if (checkinErr) throw checkinErr;
    if (!inserted) {
      return NextResponse.json({ error: "You already checked in today", code: "ALREADY_CHECKED_IN" }, { status: 409 });
    }

    // 2. Credit the wallet atomically.
    const { data: creditRows, error: creditErr } = await supabase.rpc("credit_wallet_atomic", {
      p_user_id: user.id,
      p_amount: reward,
      p_reason: `Daily check-in bonus (${new Date().toISOString().slice(0, 10)})`,
    });
    if (creditErr) {
      // Roll back the check-in claim so the user can retry.
      await supabase.from("daily_checkins").delete().eq("id", inserted.id).maybeSingle();
      throw creditErr;
    }

    const newBalance = Number(
      Array.isArray(creditRows)
        ? (creditRows[0] as { new_balance?: number | string } | undefined)?.new_balance ?? 0
        : (creditRows as { new_balance?: number | string } | null)?.new_balance ?? 0
    );

    // 3. Fire-and-forget: backup sync + notifications.
    const syncTask = syncBackupAdminClients(async (backupClient) => {
      await backupClient.from("profiles").update({ balance: newBalance }).eq("id", user.id);
      await backupClient
        .from("daily_checkins")
        .upsert(
          { id: inserted.id, user_id: user.id, reward, checkin_date: new Date().toISOString().slice(0, 10) },
          { onConflict: "id" }
        );
    }, "checkin sync");

    const tasks: Promise<unknown>[] = [
      syncTask.catch((syncErr) => {
        console.error("Check-in backup sync failed:", syncErr);
      }),
      notifyCustomer({
        client: supabase,
        email: user.email,
        message: `Daily check-in bonus claimed! +PHP ${reward.toFixed(2)} credited to your wallet. Come back tomorrow for another bonus. 🎉`,
      }).catch((err) => {
        console.error("Check-in notify failed:", err);
      }),
      sendCheckInEmail({ email: user.email, reward, balance: newBalance }).catch((err) => {
        console.error("Check-in email failed:", err);
      }),
    ];

    const results = await Promise.allSettled(tasks);
    for (const result of results) {
      if (result.status === "rejected") {
        console.error("Check-in after-response task failed:", result.reason);
      }
    }

    return NextResponse.json({
      success: true,
      reward,
      newBalance,
      checkinId: inserted.id,
    });
  } catch (err: unknown) {
    console.error("Check-in endpoint failed:", err);
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
