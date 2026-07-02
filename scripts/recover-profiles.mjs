#!/usr/bin/env node
/**
 * recover-profiles.mjs
 *
 * Recovers customer profile rows that were silently destroyed by the
 * profiles_id_fkey ON DELETE CASCADE (auth user deleted → profile row
 * cascade-deleted → email + balance + referral_code + vip_plan lost).
 *
 * What it does:
 *   1. Loads every distinct customer_email from `orders` (excluding the
 *      "[Deleted User]" anonymization marker).
 *   2. For each email that has NO matching profile row (by lower(email)),
 *      re-creates a minimal profile row:
 *        - email = the order email
 *        - balance = sum of approved topups (if we can match by email)
 *        - referral_code = generated REF-<8hex>
 *        - is_deleted = false
 *      The profile.id is left NULL (profiles.id is FK to auth.users but
 *      is_nullable after the migration drops the CASCADE constraint's
 *      NOT-null effect — actually id stays the PK; we use a random UUID
 *      since the original auth user is gone and admin only reads by email).
 *   3. Syncs the rebuilt profiles to every configured backup DB.
 *
 * Usage:
 *   node scripts/recover-profiles.mjs              # live run
 *   node scripts/recover-profiles.mjs --dry-run    # report only, no writes
 *   node scripts/recover-profiles.mjs --also-backups
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (+ BACKUP*_*)
 *      from .env.local or process.env.
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");

function parseArgs(argv) {
  const flags = { dryRun: false, alsoBackups: false };
  for (const arg of argv) {
    if (arg === "--dry-run") flags.dryRun = true;
    else if (arg === "--also-backups") flags.alsoBackups = true;
    else if (arg === "-h" || arg === "--help") {
      console.log(`recover-profiles.mjs

Rebuilds missing customer profile rows from the orders table so emails
that vanished from the admin Customers directory reappear.

Usage:
  node scripts/recover-profiles.mjs [flags]

Flags:
  --dry-run        Report what would be rebuilt without writing to the DB
  --also-backups   Also push rebuilt profiles to every configured backup DB
  -h, --help       Show this help
`);
      process.exit(0);
    }
  }
  return flags;
}

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

async function fetchAll(client, table, columns, orderBy = "created_at") {
  const PAGE = 1000;
  const all = [];
  let cursor = 0;
  while (true) {
    const { data, error } = await client
      .from(table)
      .select(columns)
      .order(orderBy, { ascending: true })
      .range(cursor, cursor + PAGE - 1);
    if (error) throw new Error(`${table} fetch failed: ${error.message}`);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    cursor += PAGE;
  }
  return all;
}

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
  console.log(`Profile recovery ${flags.dryRun ? "(DRY RUN) " : ""}started`);
  console.log(`Primary: ${supabaseUrl}`);
  if (backupClients.length) {
    console.log(`Backups: ${backupClients.map((b) => b.label).join(", ")}`);
  }
  console.log("─".repeat(64));

  // 1. Fetch all orders + existing profiles + approved topups
  console.log("Fetching orders, profiles, and approved topups...");
  const [orders, profiles, topups] = await Promise.all([
    fetchAll(supabase, "orders", "id,customer_email,amount,status,created_at"),
    fetchAll(supabase, "profiles", "id,email,balance,referral_code"),
    fetchAll(supabase, "topups", "id,email,amount,status,created_at"),
  ]);

  console.log(`  orders:    ${orders.length}`);
  console.log(`  profiles:  ${profiles.length}`);
  console.log(`  topups:    ${topups.length}`);

  // 2. Build a set of existing profile emails (lowercased, trimmed)
  const existingProfileEmails = new Set();
  for (const p of profiles) {
    if (!p.email) continue;
    const key = p.email.trim().toLowerCase();
    if (key && key !== "[deleted user]" && key !== "deleted user") {
      existingProfileEmails.add(key);
    }
  }

  // 3. Aggregate orders by email
  const emailStats = new Map();
  for (const o of orders) {
    if (!o.customer_email) continue;
    const email = o.customer_email.trim();
    const key = email.toLowerCase();
    if (key === "[deleted user]" || key === "deleted user") continue;
    if (!emailStats.has(key)) {
      emailStats.set(key, { email, orderCount: 0, totalSpent: 0, lastActive: o.created_at });
    }
    const s = emailStats.get(key);
    s.orderCount += 1;
    s.totalSpent += Number(o.amount) || 0;
    if (o.created_at && new Date(o.created_at) > new Date(s.lastActive)) {
      s.lastActive = o.created_at;
    }
  }

  // 4. Aggregate approved topups by email (for balance recovery)
  const topupsByEmail = new Map();
  for (const t of topups) {
    const status = (t.status || "").toLowerCase();
    if (status !== "approved") continue;
    if (!t.email) continue;
    const key = t.email.trim().toLowerCase();
    if (key === "[deleted user]" || key === "deleted user") continue;
    topupsByEmail.set(key, (topupsByEmail.get(key) || 0) + (Number(t.amount) || 0));
  }

  // 5. Find missing profiles
  const missing = [];
  for (const [key, stats] of emailStats) {
    if (!existingProfileEmails.has(key)) {
      missing.push({ email: stats.email, key, ...stats });
    }
  }

  console.log("─".repeat(64));
  console.log(`Missing profiles (have orders, no profile row): ${missing.length}`);

  if (missing.length === 0) {
    console.log("Nothing to recover. ✅");
    console.log("─".repeat(64));
    return;
  }

  // 6. Rebuild each missing profile
  let rebuilt = 0;
  let failed = 0;
  for (const m of missing) {
    const recoveredBalance = topupsByEmail.get(m.key) || 0;
    const newId = randomUUID();
    const referralCode = `REF-${newId.slice(0, 8).toUpperCase()}`;

    const row = {
      id: newId,
      email: m.email,
      balance: recoveredBalance,
      referral_code: referralCode,
      role: "customer",
      is_deleted: false,
      created_at: m.lastActive || new Date().toISOString(),
    };

    if (flags.dryRun) {
      rebuilt += 1;
      console.log(
        `[DRY] would rebuild ${m.email} | orders=${m.orderCount} spent=₱${m.totalSpent.toFixed(2)} ` +
          `recoveredBalance=₱${recoveredBalance.toFixed(2)} referral=${referralCode}`
      );
      continue;
    }

    const { error } = await supabase.from("profiles").upsert(row, { onConflict: "id" }).select();
    if (error) {
      // If the FK to auth.users rejects the random UUID (because we used
      // NO ACTION but the column still requires a matching auth user), fall
      // back to an insert with a NULL id won't work (id is PK). Instead, try
      // inserting without the FK by using a profile row whose id is NOT a
      // real auth user — if the FK is still enforced, this will error. The
      // migration drops the FK's CASCADE but keeps it as a reference; if you
      // hit this, run the migration first (it changes the FK to NO ACTION and
      // you may also need to make profiles.id nullable). Report and continue.
      failed += 1;
      console.error(`[${m.email}] insert failed: ${error.message}`);
      console.error(`  → Make sure the recovery migration (20260702000000_fix_profile_cascade.sql) has been applied.`);
      continue;
    }

    // Sync to backups
    if (backupClients.length) {
      await Promise.all(
        backupClients.map(async (backup) => {
          try {
            const { error: backupError } = await backup.client
              .from("profiles")
              .upsert(row, { onConflict: "id" });
            if (backupError) {
              console.warn(`[${m.email}] ${backup.label} sync failed: ${backupError.message}`);
            }
          } catch (err) {
            console.warn(`[${m.email}] ${backup.label} sync error: ${err.message || err}`);
          }
        })
      );
    }

    rebuilt += 1;
    console.log(
      `[OK] rebuilt ${m.email} | orders=${m.orderCount} spent=₱${m.totalSpent.toFixed(2)} ` +
        `balance=₱${recoveredBalance.toFixed(2)} referral=${referralCode}`
    );
  }

  console.log("─".repeat(64));
  console.log("Recovery complete");
  console.log(`  missing found   : ${missing.length}`);
  console.log(`  profiles rebuilt: ${rebuilt}`);
  console.log(`  failed          : ${failed}`);
  if (failed > 0 && !flags.dryRun) {
    console.log("");
    console.log("⚠️  Some inserts failed. Apply the migration first:");
    console.log("   supabase/migrations/20260702000000_fix_profile_cascade.sql");
    console.log("   (drops CASCADE FK so profiles.id can hold a non-auth-user UUID,");
    console.log("    or make profiles.id nullable if your schema requires it)");
  }
  console.log("─".repeat(64));
}

main().catch((err) => {
  console.error("Recovery crashed:", err);
  process.exit(1);
});