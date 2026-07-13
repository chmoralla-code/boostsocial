import { createHash } from "crypto";
import { SupabaseClient } from "@supabase/supabase-js";

const HASH_MARKER = "receipt-";

// Transaction statuses that indicate the receipt was never consumed —
// the payment was rejected, cancelled, or failed. Receipts tied to these
// rows MUST be reusable, otherwise a single rejected attempt permanently
// blocks the customer from resubmitting the same valid GCash proof.
const INACTIVE_STATUSES = new Set(["rejected", "cancelled", "failed", "declined", "voided"]);

function isInactiveStatus(status: unknown): boolean {
  return INACTIVE_STATUSES.has(String(status ?? "").trim().toLowerCase());
}

/**
 * DB-based duplicate receipt detection. Returns the referenced record id
 * (or a short type label) ONLY when a prior transaction with this hash is
 * still active — i.e. NOT rejected/cancelled/failed. Rejected attempts do
 * not block reuse because the payment was never consumed.
 *
 * Storage-bucket scans were removed because listing/downloading historical
 * receipt files could take 1–2 minutes as the bucket grew.
 */
export async function findActiveDuplicateReceiptRecord(
  supabase: SupabaseClient,
  receiptHash: string,
  excludeOrderId?: string
): Promise<string | null> {
  try {
    const ordersPromise = excludeOrderId
      ? supabase
          .from("orders")
          .select("id, status")
          .eq("receipt_hash", receiptHash)
          .neq("id", excludeOrderId)
          .limit(5)
      : supabase
          .from("orders")
          .select("id, status")
          .eq("receipt_hash", receiptHash)
          .limit(5);

    const [orders, topups, vipSubscriptions] = await Promise.all([
      ordersPromise,
      supabase.from("topups").select("id, status").eq("receipt_hash", receiptHash).limit(5),
      supabase.from("vip_subscriptions").select("id, status").eq("receipt_hash", receiptHash).limit(5),
    ]);

    const orderRows = (orders.data as Array<{ id?: string; status?: string }> | null) || [];
    for (const row of orderRows) {
      if (!isInactiveStatus(row.status)) return row.id || "order";
    }

    const topupRows = (topups.data as Array<{ id?: string; status?: string }> | null) || [];
    for (const row of topupRows) {
      if (!isInactiveStatus(row.status)) return row.id || "topup";
    }

    const vipRows = (vipSubscriptions.data as Array<{ id?: string; status?: string }> | null) || [];
    for (const row of vipRows) {
      if (!isInactiveStatus(row.status)) return row.id || "vip";
    }
  } catch (error) {
    console.warn("Active receipt hash duplicate lookup skipped:", error);
  }

  return null;
}

export async function hashReceiptFile(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  return createHash("sha256").update(buffer).digest("hex");
}

export function buildReceiptFileName(prefix: string, receiptHash: string, email: string, extension: string) {
  const safeEmail = email.trim().toLowerCase().replace(/[^a-z0-9@._-]/g, "_");
  const safeExt = extension.replace(/[^a-z0-9]/gi, "").toLowerCase() || "png";
  return `${prefix}_${HASH_MARKER}${receiptHash}_${safeEmail}.${safeExt}`;
}
