import { SupabaseClient } from "@supabase/supabase-js";
import { syncBackupAdminClients } from "@/utils/supabase/dual-db";
import { notifyCustomer } from "@/lib/customerNotifications";
import { recordOrderEvent } from "@/lib/orderEvents";

type RefundOrderInput = {
  client: SupabaseClient;
  orderId: string;
  customerEmail?: string | null;
  amount: number;
  trackingId: string;
};

/**
 * Credit a cancelled order's amount back to the customer's wallet.
 *
 * Looks up the customer profile by email, atomically credits the wallet on the
 * primary DB (credit_wallet_atomic), mirrors the new balance to backups, records
 * a "refunded" timeline event, and notifies the customer. Never throws into the
 * caller's critical path — failures are logged and swallowed.
 */
export async function refundOrderToWallet({ client, orderId, customerEmail, amount, trackingId }: RefundOrderInput) {
  const normalizedEmail = customerEmail?.trim().toLowerCase();
  const refundAmount = Number(amount);

  if (!normalizedEmail || !Number.isFinite(refundAmount) || refundAmount <= 0) {
    console.warn("Refund skipped: missing email or invalid amount", { customerEmail, amount });
    return { refunded: false, reason: "invalid_input" };
  }

  try {
    const { data: profile, error: profileError } = await client
      .from("profiles")
      .select("id, email")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile) {
      console.warn("Refund skipped: no profile found for", normalizedEmail);
      return { refunded: false, reason: "no_profile" };
    }

    const { data: creditRows, error: creditError } = await client.rpc("credit_wallet_atomic", {
      p_user_id: profile.id,
      p_amount: refundAmount,
      p_reason: `Refund for cancelled order ${trackingId}`,
    });

    if (creditError) throw creditError;

    const newBalance = Number(
      Array.isArray(creditRows)
        ? (creditRows[0] as { new_balance?: number | string } | undefined)?.new_balance ?? 0
        : (creditRows as { new_balance?: number | string } | null)?.new_balance ?? 0
    );

    await syncBackupAdminClients(async (backupClient) => {
      await backupClient
        .from("profiles")
        .update({ balance: newBalance })
        .eq("id", profile.id);
    }, "order refund balance sync");

    await recordOrderEvent({
      client,
      orderId,
      eventType: "refunded",
      fromStatus: "Cancelled",
      toStatus: "Cancelled",
      detail: `Refunded ₱${refundAmount.toFixed(2)} to wallet`,
    });

    notifyCustomer({
      client,
      email: normalizedEmail,
      message: `System update: Your order ${trackingId} was cancelled. A refund of ₱${refundAmount.toFixed(2)} was credited to your wallet (new balance ₱${newBalance.toFixed(2)}).`,
    }).catch((notificationErr) => {
      console.error("Order refund customer notification failed:", notificationErr);
    });

    return { refunded: true, newBalance };
  } catch (refundErr) {
    console.error("Order refund failed:", refundErr);
    return { refunded: false, reason: "error" };
  }
}
