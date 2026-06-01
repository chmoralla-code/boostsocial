import { createHash } from "crypto";
import { SupabaseClient } from "@supabase/supabase-js";

const RECEIPTS_BUCKET = "receipts";
const HASH_MARKER = "receipt-";

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

  // Backward-compatible check for older receipts uploaded before hash filenames existed.
  for (const file of files.slice(0, 200)) {
    if (!isReceiptCandidate(file.name)) continue;
    if (excludeReference && file.name.startsWith(excludeReference)) continue;

    try {
      const { data } = await supabase.storage.from(RECEIPTS_BUCKET).download(file.name);
      if (!data) continue;

      const existingHash = createHash("sha256")
        .update(Buffer.from(await data.arrayBuffer()))
        .digest("hex");

      if (existingHash === receiptHash) {
        return file.name;
      }
    } catch (error) {
      console.error("Receipt duplicate scan skipped a file:", error);
    }
  }

  return null;
}
