#!/usr/bin/env node
/**
 * Applies a SQL migration file to the DigitalOcean primary + every configured
 * Supabase backup (including the main Supabase project). Idempotent — all
 * migrations in this repo use CREATE TABLE IF NOT EXISTS / ALTER ... IF NOT
 * EXISTS, so this is safe to run multiple times.
 *
 * Usage:
 *   node scripts/run-migration.mjs supabase/migrations/20260806000000_feature_suite.sql
 *
 * Env: reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (primary),
 * DIGITALOCEAN_DATABASE_URL (DO primary), and BACKUP*_SUPABASE_URL /
 * BACKUP*_SUPABASE_SERVICE_ROLE_KEY (backups) from .env.local or process.env.
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");

// ── .env.local loader (no external dep) ──────────────────────────────────────
async function loadEnvFile() {
  const envPath = join(PROJECT_ROOT, ".env.local");
  try {
    const content = await readFile(envPath, "utf8");
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
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
  } catch {
    // .env.local is optional — rely on process.env.
  }
}

const SUPPORTED_LABELS = [
  { label: "PRIMARY_SUPABASE", urlKey: "NEXT_PUBLIC_SUPABASE_URL", keyKey: "SUPABASE_SERVICE_ROLE_KEY" },
  { label: "BACKUP", urlKey: "BACKUP_SUPABASE_URL", keyKey: "BACKUP_SUPABASE_SERVICE_ROLE_KEY" },
  { label: "BACKUP3", urlKey: "BACKUP3_SUPABASE_URL", keyKey: "BACKUP3_SUPABASE_SERVICE_ROLE_KEY" },
  { label: "BACKUP4", urlKey: "BACKUP4_SUPABASE_URL", keyKey: "BACKUP4_SUPABASE_SERVICE_ROLE_KEY" },
  { label: "BACKUP5", urlKey: "BACKUP5_SUPABASE_URL", keyKey: "BACKUP5_SUPABASE_SERVICE_ROLE_KEY" },
];

async function runOnSupabase(label, url, key, sql) {
  if (!url || !key) {
    console.log(`  ${label}: skipped (env not configured)`);
    return;
  }
  try {
    // The primary Supabase project's Postgres pooler URL (DATABASE_URL).
    const dbUrl = label === "PRIMARY_SUPABASE"
      ? process.env.DATABASE_URL
      : process.env[`${label}_DATABASE_URL`];
    if (!dbUrl) {
      console.warn(`  ${label}: no ${label === "PRIMARY_SUPABASE" ? "DATABASE_URL" : `${label}_DATABASE_URL`} — skipping (apply via Supabase SQL editor or set the env var)`);
      return;
    }
    const sqlClient = postgres(dbUrl, { ssl: "require", max: 1 });
    await sqlClient.unsafe(sql);
    await sqlClient.end();
    console.log(`  ${label}: applied via Postgres pooler`);
  } catch (err) {
    console.error(`  ${label}: FAILED`, err?.message || err);
    process.exitCode = 1;
  }
}

async function runOnDigitalOcean(sql) {
  const dbUrl = process.env.DIGITALOCEAN_DATABASE_URL;
  if (!dbUrl) {
    console.warn("  DigitalOcean primary: DIGITALOCEAN_DATABASE_URL not set — skipped");
    return;
  }
  try {
    const cleanUrl = dbUrl.replace("?pgbouncer=true", "");
    const sqlClient = postgres(cleanUrl, { ssl: "require", max: 1 });
    await sqlClient.unsafe(sql);
    await sqlClient.end();
    console.log("  DigitalOcean primary: applied");
  } catch (err) {
    console.error("  DigitalOcean primary: FAILED", err?.message || err);
    process.exitCode = 1;
  }
}

async function main() {
  await loadEnvFile();

  const migrationPath = process.argv[2];
  if (!migrationPath) {
    console.error("Usage: node scripts/run-migration.mjs <path-to-migration.sql>");
    process.exit(1);
  }

  const absolutePath = resolve(PROJECT_ROOT, migrationPath);
  const sql = await readFile(absolutePath, "utf8");
  console.log(`Applying ${migrationPath} (${sql.length} chars):`);

  // 1. DigitalOcean primary (master).
  await runOnDigitalOcean(sql);

  // 2. Supabase primary + backups.
  for (const cfg of SUPPORTED_LABELS) {
    await runOnSupabase(cfg.label, process.env[cfg.urlKey], process.env[cfg.keyKey], sql);
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
