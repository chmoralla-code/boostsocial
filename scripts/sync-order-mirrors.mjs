#!/usr/bin/env node
/**
 * Sync one order's mirror-sensitive fields from the primary Supabase project
 * to the DigitalOcean master and any configured Supabase backups.
 *
 * Use when an order was updated outside the normal dual-db flow (e.g. a manual
 * provider placement / hotfix) and the mirrors would otherwise show stale
 * external_order_id / external_status values.
 *
 * Usage:
 *   node scripts/sync-order-mirrors.mjs <order-id | BS-XXXXXXXX>
 *
 * Env (read from .env.local, then process.env):
 *   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY   (source read;
 *     SUPABASE_SERVICE_ROLE_KEY is preferred when present)
 *   DIGITALOCEAN_DATABASE_URL (or DATABASE_URL)               (master write)
 *   BACKUP_SUPABASE_URL / BACKUP_SUPABASE_SERVICE_ROLE_KEY    (optional)
 *   BACKUP3..BACKUP5_* same pattern                           (optional)
 *
 * Fields synced: status, external_order_id, external_status, smm_service_id.
 */
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";

const FIELDS = ["status", "external_order_id", "external_status", "smm_service_id"];
const arg = process.argv[2];
if (!arg) { console.error("Usage: node scripts/sync-order-mirrors.mjs <order-id | BS-XXXXXXXX>"); process.exit(1); }

const INVISIBLE = /[\u200B-\u200D\uFEFF]/g;
const unquote = (v) => v.trim().replace(/^["']|["']$/g, "");
function loadEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = unquote(line.slice(eq + 1).replace(INVISIBLE, "").trim());
    const assignment = val.match(/^[A-Za-z][A-Za-z0-9_]*=([\s\S]*)$/);
    if (assignment) val = unquote(assignment[1].replace(INVISIBLE, "").trim());
    out[key] = val;
  }
  return out;
}
const env = { ...loadEnvFile(path.join(process.cwd(), ".env.local")), ...process.env };

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const readKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !readKey) { console.error("Missing NEXT_PUBLIC_SUPABASE_URL / read key."); process.exit(1); }

const primary = createClient(url, readKey, { auth: { persistSession: false } });

// 1. Resolve the row on the primary.
let query = primary.from("orders").select("id, " + FIELDS.join(", "));
const hex = arg.replace(/^BS-/i, "").trim().toLowerCase();
if (/^[0-9a-f]{8}$/.test(hex)) {
  query = query.gte("id", `${hex}-0000-0000-0000-000000000000`).lte("id", `${hex}-ffff-ffff-ffff-ffffffffffff`);
} else if (/^[0-9a-f-]{36}$/i.test(arg)) {
  query = query.eq("id", arg);
} else {
  console.error("Unrecognised order id (expected a UUID or BS-XXXXXXXX)."); process.exit(1);
}
const { data: rows, error: readErr } = await query.limit(1);
if (readErr) { console.error("Primary read failed:", readErr.message); process.exit(1); }
if (!rows || rows.length === 0) { console.error("Order not found on primary."); process.exit(1); }
const order = rows[0];
const values = FIELDS.map((f) => order[f] ?? null);
console.log("Source row:", JSON.stringify(order));

let failures = 0;

// 2. DigitalOcean master write.
const doUrl = (env.DIGITALOCEAN_DATABASE_URL || env.DATABASE_URL || "").replace("?pgbouncer=true", "");
if (doUrl) {
  const sql = postgres(doUrl, { ssl: "require", idle_timeout: 5, max_lifetime: 30, connect_timeout: 15 });
  try {
    const set = FIELDS.map((f, i) => `"${f}" = $${i + 1}`).join(", ");
    const res = await sql.unsafe(`UPDATE orders SET ${set} WHERE id = $5 RETURNING id`, [...values, order.id]);
    console.log(`DigitalOcean: ${res.length === 1 ? "synced" : "NO ROWS UPDATED"}`);
    if (res.length !== 1) failures++;
  } catch (err) {
    console.error("DigitalOcean write failed:", err.message); failures++;
  } finally {
    await sql.end();
  }
} else {
  console.warn("DigitalOcean: DIGITALOCEAN_DATABASE_URL not set - skipped.");
  failures++;
}

// 3. Supabase backups (primary is the source, so only BACKUP* targets here).
for (const label of ["BACKUP", "BACKUP3", "BACKUP4", "BACKUP5"]) {
  const bUrl = env[`${label}_SUPABASE_URL`];
  const bKey = env[`${label}_SUPABASE_SERVICE_ROLE_KEY`];
  if (!bUrl || !bKey) { console.warn(`${label}: not configured - skipped.`); continue; }
  try {
    const client = createClient(bUrl, bKey, { auth: { persistSession: false } });
    const { error } = await client.from("orders").update(Object.fromEntries(FIELDS.map((f, i) => [f, values[i]]))).eq("id", order.id);
    console.log(`${label}: ${error ? "failed - " + error.message : "synced"}`);
    if (error) failures++;
  } catch (err) {
    console.error(`${label} write failed:`, err.message); failures++;
  }
}

process.exit(failures > 0 ? 2 : 0);
