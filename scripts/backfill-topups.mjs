#!/usr/bin/env node
/**
 * Top-ups receipt backfill & compression script.
 *
 * Walks every row in the `topups` table whose `receipt_url` is an inline
 * base64 data URL (the format produced by /api/topup/create), decodes it,
 * re-runs the same sharp compression pipeline used for new uploads, and
 * writes the smaller JPEG data URL back. This reclaims database row size
 * on Supabase Pro without touching receipt_hash (so duplicate detection
 * stays consistent) and without re-running AI verification.
 *
 * Usage:
 *   node scripts/backfill-topups.mjs                # live run, primary DB
 *   node scripts/backfill-topups.mjs --dry-run      # report only, no writes
 *   node scripts/backfill-topups.mjs --limit 50     # cap rows processed
 *   node scripts/backfill-topups.mjs --also-backups # sync compressed bytes to backup DBs
 *   node scripts/backfill-topups.mjs --min-bytes 200000  # only compress rows >= 200KB
 *
 * Env: reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from
 * .env.local (or process.env). Backup DBs use BACKUP*_SUPABASE_URL /
 * BACKUP*_SUPABASE_SERVICE_ROLE_KEY when --also-backups is passed.
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");

// ── Compression constants (mirror src/utils/serverImageCompressor.ts) ────────
const MAX_RECEIPT_DIMENSION = 1280;
const TARGET_RECEIPT_BYTES = 900 * 1024;
const INITIAL_QUALITY = 72;
const MIN_QUALITY = 35;
const QUALITY_STEP = 10;

// ── CLI flag parsing ──────────────────────────────────────────────────────────
function parseArgs(argv) {
  const flags = {
    dryRun: false,
    alsoBackups: false,
    limit: 0,
    minBytes: 0,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") flags.dryRun = true;
    else if (arg === "--also-backups") flags.alsoBackups = true;
    else if (arg === "--limit") flags.limit = Number(argv[++i]) || 0;
    else if (arg === "--min-bytes") flags.minBytes = Number(argv[++i]) || 0;
    else if (arg === "-h" || arg === "--help") {
      console.log(`Top-ups receipt backfill & compression

Usage:
  node scripts/backfill-topups.mjs [flags]

Flags:
  --dry-run            Report what would change without writing to the DB
  --limit <n>          Cap the number of rows processed
  --min-bytes <n>      Only compress rows whose current data URL is >= n bytes
  --also-backups       Also push compressed bytes to every configured backup DB
  -h, --help           Show this help
`);
      process.exit(0);
    }
  }
  return flags;
}

// ── .env.local loader (no external dep) ──────────────────────────────────────
async function loadEnvFile() {
  const envPath = join(PROJECT_ROOT, ".env.local");
  let raw;
  try {
    raw = await readFile(envPath, "utf8");
  } catch {
    return;
  }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing env var: ${name}`);
    process.exit(1);
  }
  return value;
}

// ── Data URL helpers ──────────────────────────────────────────────────────────
const DATA_URL_RE = /^data:([\w.+-]+\/[\w.+-]+);base64,(.*)$/;

function parseDataUrl(url) {
  const match = DATA_URL_RE.exec(url);
  if (!match) return null;
  return { mimeType: match[1], base64: match[2] };
}

function bytesToHuman(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

// ── Compression pipeline (mirrors serverImageCompressor.compressReceiptImage) ─
async function compressBytes(inputBuffer) {
  const pipeline = sharp(inputBuffer, { failOn: "none" })
    .rotate()
    .resize({
      width: MAX_RECEIPT_DIMENSION,
      height: MAX_RECEIPT_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    });

  let quality = INITIAL_QUALITY;
  let output = await pipeline.clone().jpeg({ quality }).toBuffer();

  while (output.byteLength > TARGET_RECEIPT_BYTES && quality > MIN_QUALITY) {
    quality = Math.max(MIN_QUALITY, quality - QUALITY_STEP);
    output = await pipeline.clone().jpeg({ quality }).toBuffer();
  }

  return output;
}

// ── Backup DB sync ────────────────────────────────────────────────────────────
function getBackupConfigs() {
  const configs = [];
  const labels = ["BACKUP", "BACKUP3", "BACKUP4", "BACKUP5"];
  for (const label of labels) {
    const url = process.env[`${label}_SUPABASE_URL`];
    const key = process.env[`${label}_SUPABASE_SERVICE_ROLE_KEY`];
    if (url && key) configs.push({ label, url, key });
  }
  return configs;
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const flags = parseArgs(process.argv.slice(2));
  await loadEnvFile();

  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const backupClients = flags.alsoBackups
    ? getBackupConfigs().map(({ label, url, key }) => ({
        label,
        client: createClient(url, key, { auth: { persistSession: false } }),
      }))
    : [];

  console.log("─".repeat(64));
  console.log(`Top-ups receipt backfill ${flags.dryRun ? "(DRY RUN) " : ""}started`);
  console.log(`Primary: ${supabaseUrl}`);
  if (backupClients.length) {
    console.log(`Backups: ${backupClients.map((b) => b.label).join(", ")}`);
  }
  if (flags.limit) console.log(`Row limit: ${flags.limit}`);
  if (flags.minBytes) console.log(`Min bytes filter: ${flags.minBytes}`);
  console.log("─".repeat(64));

  const PAGE = 100;
  let processed = 0;
  let compressed = 0;
  let skippedExternal = 0;
  let skippedAlreadySmall = 0;
  let skippedUncompressible = 0;
  let failed = 0;
  let totalBefore = 0;
  let totalAfter = 0;
  let cursor = 0;

  while (true) {
    if (flags.limit && processed >= flags.limit) break;

    const fetchSize = flags.limit ? Math.min(PAGE, flags.limit - processed) : PAGE;

    const { data, error } = await supabase
      .from("topups")
      .select("id,email,amount,receipt_url,receipt_hash,status,created_at")
      .order("created_at", { ascending: true })
      .range(cursor, cursor + fetchSize - 1);

    if (error) {
      console.error("Fetch failed:", error.message);
      process.exit(1);
    }
    if (!data || data.length === 0) break;

    for (const row of data) {
      processed += 1;
      cursor += 1;

      const receiptUrl = row.receipt_url || "";
      if (!receiptUrl) {
        console.log(`[${row.id}] skip: empty receipt_url`);
        continue;
      }

      const parsed = parseDataUrl(receiptUrl);
      if (!parsed) {
        skippedExternal += 1;
        console.log(
          `[${row.id}] skip: external URL (not a data URL) — ${receiptUrl.slice(0, 60)}...`
        );
        continue;
      }

      const originalBuffer = Buffer.from(parsed.base64, "base64");
      const originalBytes = originalBuffer.byteLength;
      totalBefore += originalBytes;

      if (flags.minBytes && originalBytes < flags.minBytes) {
        skippedAlreadySmall += 1;
        console.log(
          `[${row.id}] skip: ${bytesToHuman(originalBytes)} < min-bytes ${bytesToHuman(flags.minBytes)}`
        );
        continue;
      }

      let compressedBuffer;
      try {
        compressedBuffer = await compressBytes(originalBuffer);
      } catch (err) {
        skippedUncompressible += 1;
        console.error(`[${row.id}] compress failed:`, err.message || err);
        continue;
      }

      const compressedBytes = compressedBuffer.byteLength;

      // Skip if compression didn't help (already compact or already JPEG at target).
      if (compressedBytes >= originalBytes) {
        skippedAlreadySmall += 1;
        console.log(
          `[${row.id}] skip: already compact (${bytesToHuman(originalBytes)} → ${bytesToHuman(compressedBytes)})`
        );
        continue;
      }

      // Verify the receipt content hash is unchanged. We hash the original
      // bytes (the same thing hashReceiptFile does), so this is a safety net
      // against accidental content drift — we never overwrite receipt_hash.
      const originalHash = row.receipt_hash || sha256(originalBuffer);

      const newDataUrl = `data:image/jpeg;base64,${compressedBuffer.toString("base64")}`;
      totalAfter += compressedBytes;

      if (flags.dryRun) {
        compressed += 1;
        console.log(
          `[${row.id}] would compress ${bytesToHuman(originalBytes)} → ${bytesToHuman(compressedBytes)} ` +
            `(${(((1 - compressedBytes / originalBytes) * 100)).toFixed(1)}% smaller)`
        );
        continue;
      }

      const { error: updateError } = await supabase
        .from("topups")
        .update({ receipt_url: newDataUrl })
        .eq("id", row.id);

      if (updateError) {
        failed += 1;
        totalAfter -= compressedBytes;
        console.error(`[${row.id}] update failed:`, updateError.message);
        continue;
      }

      // Sync compressed bytes to backup DBs (best-effort).
      if (backupClients.length) {
        await Promise.all(
          backupClients.map(async (backup) => {
            try {
              const { error: backupError } = await backup.client
                .from("topups")
                .update({ receipt_url: newDataUrl })
                .eq("id", row.id);
              if (backupError) {
                console.warn(`[${row.id}] ${backup.label} sync failed:`, backupError.message);
              }
            } catch (err) {
              console.warn(`[${row.id}] ${backup.label} sync error:`, err.message || err);
            }
          })
        );
      }

      compressed += 1;
      console.log(
        `[${row.id}] ok  ${bytesToHuman(originalBytes)} → ${bytesToHuman(compressedBytes)} ` +
          `(${(((1 - compressedBytes / originalBytes) * 100)).toFixed(1)}% smaller) hash=${originalHash.slice(0, 10)}`
      );

      if (flags.limit && processed >= flags.limit) break;
    }

    if (data.length < fetchSize) break;
  }

  console.log("─".repeat(64));
  console.log("Backfill complete");
  console.log(`  rows scanned     : ${processed}`);
  console.log(`  rows compressed  : ${compressed}`);
  console.log(`  skipped external : ${skippedExternal}`);
  console.log(`  skipped small    : ${skippedAlreadySmall}`);
  console.log(`  skipped (errors) : ${skippedUncompressible}`);
  console.log(`  failed updates   : ${failed}`);
  if (compressed > 0) {
    const saved = totalBefore - (flags.dryRun ? totalAfter : totalAfter);
    console.log(`  bytes before     : ${bytesToHuman(totalBefore)}`);
    console.log(`  bytes after      : ${bytesToHuman(totalAfter)}`);
    console.log(`  bytes saved      : ${bytesToHuman(saved)} (${compressed} rows)`);
  }
  console.log("─".repeat(64));
}

main().catch((err) => {
  console.error("Backfill crashed:", err);
  process.exit(1);
});
