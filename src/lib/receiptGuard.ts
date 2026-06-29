import { createHash } from "crypto";
import { SupabaseClient } from "@supabase/supabase-js";

const RECEIPTS_BUCKET = "receipts";
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
 * This replaces the older `findDuplicateReceiptRecord` helpers that matched
 * any row regardless of status and caused false-positive "already used"
 * errors on legitimate resubmissions.
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

function isReceiptCandidate(name: string) {
  const lower = name.toLowerCase();
  return (
    !lower.startsWith("admin-config/") &&
    !lower.includes("admin-config") &&
    /\.(png|jpe?g|webp)$/i.test(name)
  );
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

export async function findDuplicateReceipt(
  supabase: SupabaseClient,
  receiptHash: string,
  excludeReference?: string
) {
  const { data: files, error } = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .list("", { limit: 1000, sortBy: { column: "created_at", order: "desc" } });

  if (error || !files?.length) {
    return null;
  }

  for (const file of files) {
    if (!isReceiptCandidate(file.name)) continue;
    if (excludeReference && file.name.startsWith(excludeReference)) continue;

    if (file.name.includes(`${HASH_MARKER}${receiptHash}`)) {
      return file.name;
    }
  }

  // NOTE: The previous implementation re-downloaded up to 200 files and
  // re-hashed them to catch receipts uploaded before hash-based filenames
  // existed. That path produced false-positive "already used" errors because
  // orphan files from rejected/cancelled orders linger in the bucket. The
  // authoritative duplicate check is the DB hash lookup in
  // `findActiveDuplicateReceiptRecord`, which respects transaction status —
  // so we intentionally do NOT re-hash bucket files here.

  return null;
}
