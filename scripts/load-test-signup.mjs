#!/usr/bin/env node
/**
 * Signup load test for the /api/auth/signup endpoint.
 *
 * Fires N registrations in waves so you can see how the endpoint behaves under
 * concurrency: per-request status, latency and the server's own message.
 *
 * The generated addresses are deliberately built to pass the endpoint's own
 * guard rails (RFC 5322 syntax, disposable-domain blocklist, role-based
 * username check, junk-username check, typo check, DNS MX lookup), so a
 * rejection here means the real signup path broke, not that the test data was
 * rejected up front.
 *
 * Two targets are supported:
 *
 *   --mode next      POST to a Next.js <base>/api/auth/signup route (the
 *                    boostsocial app in this repo).
 *   --mode supabase  POST to a Supabase project's /auth/v1/signup, which is
 *                    what the static hormachuelos.com register page does from
 *                    the browser. Needs SIGNUP_ANON_KEY in the environment.
 *
 * Usage:
 *   node scripts/load-test-signup.mjs --url http://localhost:3000
 *   node scripts/load-test-signup.mjs --mode supabase \
 *     --supabase-url https://<project>.supabase.co --count 10 --concurrency 2
 *
 * Options:
 *   --mode         "next" (default) or "supabase"
 *   --url          Base URL for --mode next (default: https://hormachuelos.com)
 *   --supabase-url Supabase project URL for --mode supabase
 *   --count        How many accounts to create (default: 10)
 *   --concurrency  How many requests to fire at once (default: 5)
 *   --domain       Email domain to use; must have MX records (default: gmail.com)
 *   --tag          Fixed label mixed into the email local part (default: random)
 *   --dry-run      Print the requests without sending them
 *
 * The Supabase anon/publishable key is read from SIGNUP_ANON_KEY and is never
 * printed, so it stays out of the output and out of this file.
 *
 * WARNING: this creates real, unconfirmed auth users in whatever database the
 * target points at. Only run it against an environment you own.
 */

import { randomBytes } from "node:crypto";

// ── args ─────────────────────────────────────────────────────────────────────
function readArgs(argv) {
  const out = { dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      out.dryRun = true;
      continue;
    }
    const match = /^--([a-z-]+)(?:=(.*))?$/.exec(arg);
    if (!match) continue;
    const key = match[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const value = match[2] ?? argv[++i];
    if (key === "count" || key === "concurrency") {
      out[key] = Number(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

const args = readArgs(process.argv.slice(2));
const MODE = args.mode === "supabase" ? "supabase" : "next";
const BASE_URL = (args.url || "https://hormachuelos.com").replace(/\/+$/, "");
const SUPABASE_URL = (args.supabaseUrl || process.env.SIGNUP_SUPABASE_URL || "").replace(/\/+$/, "");
const ANON_KEY = process.env.SIGNUP_ANON_KEY || "";
const COUNT = Number.isFinite(args.count) && args.count > 0 ? args.count : 10;
const CONCURRENCY =
  Number.isFinite(args.concurrency) && args.concurrency > 0 ? args.concurrency : 5;
const DOMAIN = args.domain || "gmail.com";
const TAG = args.tag || `load${randomBytes(3).toString("hex")}`;

// Local part avoids every junk pattern in the route (test\d*, fake\d*, ...),
// every role-based name (admin, info, ...) and every keyboard smash, while
// staying under the 2-character minimum after separators are stripped.
function makeIdentity(index) {
  const suffix = randomBytes(6).toString("hex");
  return {
    email: `${TAG}.signup${index}.${suffix}@${DOMAIN}`,
    password: `LoadTest!${randomBytes(4).toString("hex")}`,
  };
}

async function register({ email, password }) {
  const started = Date.now();
  try {
    const target =
      MODE === "supabase" ? `${SUPABASE_URL}/auth/v1/signup` : `${BASE_URL}/api/auth/signup`;
    const headers = { "content-type": "application/json" };
    if (MODE === "supabase") {
      headers.apikey = ANON_KEY;
      headers.authorization = `Bearer ${ANON_KEY}`;
    }
    const res = await fetch(target, {
      method: "POST",
      headers,
      body: JSON.stringify({ email, password }),
    });
    const ms = Date.now() - started;
    let body = null;
    let raw = "";
    try {
      raw = await res.text();
      body = JSON.parse(raw);
    } catch {
      body = { error: raw.slice(0, 200) };
    }
    return { email, password, status: res.status, ms, body };
  } catch (err) {
    return {
      email,
      password,
      status: 0,
      ms: Date.now() - started,
      body: { error: err instanceof Error ? err.message : String(err) },
    };
  }
}

function describe(body) {
  if (!body) return "";
  if (MODE === "supabase") {
    if (body.error_description) return `error: ${body.error_description}`;
    if (body.msg) return `error: ${body.msg}`;
    if (body.error) return `error: ${body.error}`;
    if (body.id || body.user) return "created (confirmation email requested)";
    return "unrecognised response";
  }
  if (body.error) return `error: ${body.error}`;
  if (body.existing_account) return "existing unconfirmed account re-sent a code";
  if (body.success) {
    if (body.otp_sent) return "created + verification code sent";
    return `created, code NOT sent${body.otp_error ? ` (${body.otp_error})` : ""}`;
  }
  return "unrecognised response";
}

// ── run ──────────────────────────────────────────────────────────────────────
if (MODE === "supabase" && !args.dryRun) {
  if (!SUPABASE_URL) {
    console.error("--mode supabase needs --supabase-url (or SIGNUP_SUPABASE_URL)");
    process.exit(1);
  }
  if (!ANON_KEY) {
    console.error("--mode supabase needs SIGNUP_ANON_KEY in the environment");
    process.exit(1);
  }
}

const TARGET =
  MODE === "supabase" ? `${SUPABASE_URL}/auth/v1/signup` : `${BASE_URL}/api/auth/signup`;
console.log(`Signup load test [${MODE}] → ${TARGET}`);
console.log(
  `${COUNT} account(s), concurrency ${CONCURRENCY}, domain @${DOMAIN}, tag "${TAG}"` +
    (args.dryRun ? "  [DRY RUN]" : "")
);
console.log("".padEnd(72, "-"));

const identities = Array.from({ length: COUNT }, (_, i) => makeIdentity(i + 1));

if (args.dryRun) {
  for (const identity of identities) {
    console.log(`would POST ${identity.email}`);
  }
  process.exit(0);
}

const results = [];
const startedAll = Date.now();

for (let i = 0; i < identities.length; i += CONCURRENCY) {
  const wave = identities.slice(i, i + CONCURRENCY);
  const waveNo = Math.floor(i / CONCURRENCY) + 1;
  console.log(`\nWave ${waveNo} (${wave.length} concurrent)`);
  const settled = await Promise.all(wave.map(register));
  for (const result of settled) {
    results.push(result);
    const ok = result.status === 200;
    console.log(
      `  ${ok ? "OK  " : "FAIL"} ${String(result.status).padEnd(3)} ` +
        `${String(result.ms).padStart(5)}ms  ${describe(result.body)}`
    );
  }
}

const totalMs = Date.now() - startedAll;
const created = results.filter(
  (r) => r.status === 200 && (MODE === "supabase" ? true : r.body?.success)
).length;
const failed = results.filter((r) => r.status !== 200).length;
const latencies = results.map((r) => r.ms).sort((a, b) => a - b);
const p50 = latencies[Math.floor(latencies.length * 0.5)] ?? 0;
const p95 = latencies[Math.floor(latencies.length * 0.95)] ?? 0;

console.log("\n" + "".padEnd(72, "-"));
console.log(`Created: ${created}/${results.length}   Failed: ${failed}`);
console.log(`Total: ${totalMs}ms   p50: ${p50}ms   p95: ${p95}ms`);
console.log(`Slowest: ${Math.max(...latencies, 0)}ms   Fastest: ${Math.min(...latencies, 0)}ms`);

const failures = results.filter((r) => r.status !== 200);
if (failures.length) {
  console.log("\nFailures:");
  const grouped = new Map();
  for (const f of failures) {
    const raw = f.body?.error ?? f.body?.error_description ?? f.body?.msg ?? "unknown";
    const key = `${f.status} ${String(raw).replace(/\s+/g, " ").trim()}`;
    grouped.set(key, (grouped.get(key) ?? 0) + 1);
  }
  for (const [key, n] of grouped) console.log(`  ${n}× ${key}`);
}

console.log("\nAccounts created (unconfirmed until the emailed code is entered):");
for (const r of results) {
  const ok = r.status === 200 && (MODE === "supabase" ? true : r.body?.success);
  if (ok) console.log(`  ${r.email}  /  ${r.password}`);
}
