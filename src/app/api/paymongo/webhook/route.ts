import { after, NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  extractPaidDetails,
  isPaymongoConfigured,
  isPaymongoTestMode,
  verifyPaymongoSignature,
} from "@/lib/paymongo";
import { sendAdminAlert } from "@/lib/telegram";
import { notifyCustomer } from "@/lib/customerNotifications";
import { creditReferralCommission } from "@/utils/referrals";
import { sendTopupApprovedEmail } from "@/lib/approvalEmails";
import { syncBackupAdminClients } from "@/utils/supabase/dual-db";

// Needs node crypto for the HMAC check, so keep it on the Node runtime.
export const runtime = "nodejs";

// Event types that mean "money actually arrived".
const PAID_EVENT_TYPES = new Set([
  "checkout_session.payment.paid",
  "payment.paid",
]);

// Event types that mean "this attempt is over and no money moved".
const FAILED_EVENT_TYPES = new Set([
  "checkout_session.payment.failed",
  "payment.failed",
]);

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Server configuration missing");
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

export async function POST(req: NextRequest) {
  // 1. Read the RAW body first. The signature is over the raw bytes, so
  //    parsing to JSON before verifying would break the check.
  const rawBody = await req.text();

  if (!isPaymongoConfigured()) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  // 2. Verify the signature. A bad signature does nothing else — 401 and stop.
  const signature = req.headers.get("paymongo-signature");
  if (!verifyPaymongoSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // 3. Only now is it safe to parse.
  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const eventType: string = event?.data?.attributes?.type || "";
  const eventId: string | null = event?.data?.id || null;

  if (!eventId) {
    return NextResponse.json({ error: "Missing event id" }, { status: 400 });
  }

  // While a TEST key is in use, every alert is clearly tagged so test money is
  // never mistaken for a live transaction in the Telegram channel.
  const testTag = isPaymongoTestMode() ? "\uD83E\uDDEA [TEST] " : "";

  try {
    const supabase = getAdminClient();
    const details = extractPaidDetails(event);

    // ── Failed / expired attempt ────────────────────────────────
    // Nothing was paid, so the top-up stays pending for a retry.
    if (FAILED_EVENT_TYPES.has(eventType)) {
      if (details.sessionId) {
        await supabase
          .from("paymongo_topups")
          .update({ status: "failed", raw_event: event })
          .eq("checkout_session_id", details.sessionId)
          .in("status", ["pending"]);
      }
      return NextResponse.json({ received: true });
    }

    if (!PAID_EVENT_TYPES.has(eventType)) {
      // Unknown but signed events are acknowledged so PayMongo stops retrying.
      return NextResponse.json({ received: true });
    }

    // A `payment.paid` event carries no checkout session id of its own — only
    // the metadata we attached when the session was created. Resolve our row
    // from that top-up id, so the payment is still credited. When it is a
    // duplicate of the matching `checkout_session.payment.paid` event, the RPC
    // simply reports "already paid" and nothing is credited twice.
    let resolvedSessionId = details.sessionId;
    if (!resolvedSessionId && details.topupId) {
      const { data: byTopup } = await supabase
        .from("paymongo_topups")
        .select("checkout_session_id")
        .eq("topup_id", details.topupId)
        .maybeSingle();
      resolvedSessionId = byTopup?.checkout_session_id || null;
    }

    if (!resolvedSessionId) {
      // Nothing here identifies one of our top-ups. One PayMongo account can
      // serve several businesses, and every webhook on that account receives
      // every payment — so a payment that is not ours is acknowledged quietly
      // instead of paging an admin on every sale somewhere else.
      // We only raise a warning when the event carries OUR top-up marker and
      // still cannot be matched, because that means one of our own payments is
      // genuinely unaccounted for.
      if (details.topupId) {
        await sendAdminAlert({
          title: `${testTag}⚠️ PayMongo webhook: unknown top-up`,
          message: `Event ${eventId} (${eventType}) carried our top-up id ${details.topupId} but no matching row was found.`,
        });
      }
      return NextResponse.json({ received: true });
    }

    // Captured here so the narrowing survives into the after() closure below.
    const sessionId: string = resolvedSessionId;

    if (details.paidCentavos === null) {
      await sendAdminAlert({
        title: `${testTag}⚠️ PayMongo webhook: missing amount`,
        message: `Paid event ${eventId} for session ${sessionId} had no amount, so it was not credited.`,
      });
      return NextResponse.json({ received: true });
    }

    // ── Confirm atomically ──────────────────────────────────────
    // The RPC locks the row, checks idempotency and the amount, flips the
    // order, credits the wallet and marks the top-up approved — all or nothing.
    const { data, error } = await supabase.rpc("confirm_paymongo_topup", {
      p_checkout_session_id: sessionId,
      p_event_id: eventId,
      p_centavos: details.paidCentavos,
      p_method: details.method,
      p_payment_id: details.paymentId,
      p_raw: event,
    });

    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    const confirmed = Boolean(row?.confirmed);
    const topupId: string | null = row?.topup_id || null;
    const customerId: string | null = row?.user_id || null;
    const amount: number | null = row?.amount ?? null;
    const newBalance: number | null = row?.new_balance ?? null;

    if (!confirmed) {
      // Either already handled (safe retry) or an amount mismatch. Look up the
      // current row to tell the two apart for the admin alert.
      const { data: pmRow } = await supabase
        .from("paymongo_topups")
        .select("status, amount_centavos, email")
        .eq("checkout_session_id", sessionId)
        .maybeSingle();

      if (pmRow?.status === "amount_mismatch") {
        await sendAdminAlert({
          title: `${testTag}🚨 PayMongo amount mismatch`,
          message:
            `Session ${sessionId} paid ${details.paidCentavos} centavos but expected ` +
            `${pmRow.amount_centavos} centavos (${pmRow.email}). The wallet was NOT credited. ` +
            `Check the PayMongo dashboard before acting.`,
        });
      }

      // Already paid earlier: acknowledge so PayMongo stops retrying.
      return NextResponse.json({ received: true });
    }

    // ── Side effects, after the response ────────────────────────
    after(async () => {
      // Mirror the wallet credit the RPC made on the primary project out to the
      // DigitalOcean master and every backup, exactly like /api/admin/approve-topup
      // does. Without this the master keeps the old balance, and because reads are
      // served from the master first the customer would see a stale wallet.
      if (customerId && newBalance !== null) {
        await syncBackupAdminClients(async (backupClient) => {
          return backupClient
            .from("profiles")
            .update({ balance: newBalance })
            .eq("id", customerId);
        }, "paymongo profile balance sync");
      }

      if (topupId) {
        await syncBackupAdminClients(async (backupClient) => {
          return backupClient
            .from("topups")
            .update({
              status: "approved",
              amount,
              reviewed_by: "PayMongo",
            })
            .eq("id", topupId);
        }, "paymongo top-up approval sync");
      }

      await syncBackupAdminClients(async (backupClient) => {
        return backupClient
          .from("paymongo_topups")
          .update({
            status: "paid",
            payment_method: details.method,
            paymongo_payment_id: details.paymentId,
            paymongo_event_id: eventId,
          })
          .eq("checkout_session_id", sessionId);
      }, "paymongo payment sync");

      if (customerId && amount) {
        try {
          await creditReferralCommission({
            primaryClient: supabase,
            customerId,
            source: "topup",
            amount,
            referenceId: topupId || sessionId,
          });
        } catch (commissionError) {
          console.error("PayMongo referral commission failed:", commissionError);
        }
      }

      try {
        await sendAdminAlert({
          title: `${testTag}✅ PayMongo top-up paid`,
          message:
            `A PayMongo wallet top-up was paid and credited automatically.\n` +
            `Session: ${sessionId}\n` +
            `Method: ${details.method || "unknown"}\n` +
            `Amount: ₱${Number(amount ?? 0).toFixed(2)}\n` +
            `Top-up: ${topupId || "n/a"}`,
        });
      } catch (telegramErr) {
        console.error("PayMongo paid admin alert failed:", telegramErr);
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", customerId)
        .maybeSingle();

      if (profile?.email) {
        sendTopupApprovedEmail({
          email: profile.email,
          amount: Number(amount ?? 0),
        }).catch((emailErr) => {
          console.error("PayMongo top-up email failed:", emailErr);
        });

        notifyCustomer({
          client: supabase,
          email: profile.email,
          message: `System update: Your PHP ${Number(amount ?? 0).toFixed(2)} wallet top-up was paid via PayMongo and credited instantly! 🚀`,
        }).catch((notificationErr) => {
          console.error("PayMongo customer notification failed:", notificationErr);
        });
      }
    });

    return NextResponse.json({ received: true, credited: true });
  } catch (err: any) {
    // Return 500 so PayMongo retries — but the RPC is idempotent, so a retry
    // can never credit twice.
    console.error("PayMongo webhook failed:", err);
    return NextResponse.json(
      { error: err?.message || "Webhook processing failed" },
      { status: 500 }
    );
  }
}
