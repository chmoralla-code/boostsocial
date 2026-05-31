import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { getPrimaryAdminClient } from "@/utils/supabase/dual-db";
import { enforceRateLimit } from "@/utils/security/rate-limit";
import { getReferralSummary, isCommissionTransaction } from "@/utils/referrals";
import { REFERRAL_MIN_PAYOUT, REFERRAL_TIERS } from "@/utils/referral-program";

function obscureEmail(email?: string | null) {
  if (!email) return "Referral";
  const [local, domain] = email.split("@");
  if (!local || !domain) return "Referral";
  if (local.length <= 2) return `${local}**@${domain}`;
  return `${local.slice(0, 2)}***@${domain}`;
}

export async function GET(req: NextRequest) {
  try {
    const rateLimitResponse = enforceRateLimit(req, {
      key: "referrals-summary",
      maxRequests: 60,
      windowMs: 60_000,
    });
    if (rateLimitResponse) return rateLimitResponse;

    const sessionClient = await createServerClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();

    if (!user?.id) {
      return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
    }

    const adminClient = getPrimaryAdminClient();
    const summary = await getReferralSummary(adminClient, user.id);

    const { data: transactions, error: transactionError } = await adminClient
      .from("referral_transactions")
      .select("id, referee_id, amount, description, created_at")
      .eq("referrer_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);

    if (transactionError) throw transactionError;

    const commissionTransactions = (transactions || []).filter(isCommissionTransaction);
    const refereeIds = Array.from(new Set(commissionTransactions.map((tx) => tx.referee_id).filter(Boolean)));
    const emailById = new Map<string, string>();

    if (refereeIds.length > 0) {
      const { data: referees, error: refereeError } = await adminClient
        .from("profiles")
        .select("id, email")
        .in("id", refereeIds);

      if (refereeError) throw refereeError;
      for (const referee of referees || []) {
        emailById.set(referee.id, referee.email || "");
      }
    }

    return NextResponse.json({
      success: true,
      minPayout: REFERRAL_MIN_PAYOUT,
      tiers: REFERRAL_TIERS,
      ...summary,
      transactions: commissionTransactions.map((tx) => ({
        id: tx.id,
        amount: Number(tx.amount || 0),
        description: tx.description || "Referral commission",
        created_at: tx.created_at,
        refereeLabel: obscureEmail(emailById.get(tx.referee_id)),
      })),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Referral summary endpoint failed:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
