# PinoyBoosting — Deep Study (Part 7: The Unfinished Edges)

Parts 1–6 covered architecture, money, security, data model, the trust chain and
operations. This part covers the ground they did **not** reach: the AI provider
chain, the customer-facing mobile/PWA layer, SEO, and — the headline — **three
features that are visible to customers but not actually finished**.

Everything below was verified against the **live site** and **both live
databases** (DigitalOcean master + Supabase mirror), read-only.

---

## 0. The one-sentence finding

The core business is finished and well built; the **periphery is not** — a ₱499
product card, a downloadable Chrome extension, and a track-page viewer all exist
in production and none of them can actually do what they appear to do.

---

## 1. The AI provider chain — **Solid, with a naming lie**

`src/lib/neuralwatt.ts` (491 lines) is an OpenAI-compatible client with a
fallback chain:

| Order | Provider | Model | Env |
|---|---|---|---|
| 1 | CommandCode | `deepseek/deepseek-v4.1-flash` | `COMMANDCODE_API_KEY` |
| 2 | OpenRouter (free router) | `openrouter/free` | `OPENROUTER_API_KEY` |

Used by both chat routes and the receipt verifier.

**Genuinely well built:**

- **Env normalisation.** `normalizeEnvValue()` strips a leading `KEY=` and stray
  quotes. The comment says this exists because a dashboard once stored a whole
  `COMMANDCODE_BASE_URL=https://...` string in the value field, which produced an
  invalid URL and killed every AI call — surfacing to customers only as a canned
  reply. That is real scar tissue from a real incident.
- **`validBaseUrl()` rejects a malformed URL early**, so the chain moves to the
  next provider instead of failing later inside `fetch`.
- **Timeout discipline.** A timeout is treated as **final** — no second attempt —
  because 2 × 45 s would outlive the route's 60 s limit and get killed with no
  recorded reason. Only retryable statuses (402/408/429/5xx) and auth errors fall
  through to the next provider.
- **Empty-content recovery.** Reasoning models sometimes burn the whole token
  budget on thinking and return nothing. The client detects
  `finish_reason === "length"`, enlarges the budget (×4, ceiling 4096), and
  re-asks — but only if enough time remains, otherwise it salvages the
  `reasoning` text and returns that instead of an empty string.
- **400 fallback.** If a model rejects the strict JSON schema, it drops
  `response_format` and retries once, because the receipt verifier can parse
  plain JSON out of message content anyway.

**The naming lie:** the file, its exports (`requestNeuralwattChat`,
`NEURALWATT_CHAT_MODEL`), and `src/lib/neuralwatt.ts` itself still say
"Neuralwatt" — but **Neuralwatt is not in the provider chain at all.** The
comment admits the name was kept on purpose to avoid churn at call sites. It is
harmless, but it will mislead the next person who greps for the AI provider.

---

## 2. The Chrome extension — **a simulation, not an automation tool**

`public/extension/` (5 files, tracked in git) plus `public/boostsocial-bot.zip`
are served live — all four files return **HTTP 200** from
`pinoyboosting.com/extension/*`.

The manifest calls it **"CYNETWORK Facebook Autonomous Bot"**, version 1.1.0, and
requests `activeTab`, `tabs`, `scripting`, `alarms`, `storage`, `offscreen` plus
host access to `https://*.facebook.com/*`.

### What it actually does

Reading `content.js` and `offscreen.js` line by line: **it posts nothing.**

- `content.js` clicks a composer button if it can find one, injects the caption
  with `document.execCommand('insertText')` — and then **`await sleep(2000)`** and
  logs `"🟢 [SUCCESS] Feed post published! fb.com/posts/cynetwork_<random>"`. The
  post id is `Math.random()`. **No image is ever attached**, despite the log
  saying "Attaching product image media asset".
- The **group-sharing section is entirely fabricated.** It logs three hardcoded
  successes for group names ("Philippines eCommerce Buy & Sell (45k members)",
  "Direct Seller Online Hub PH", "SMM & Marketplace Davao Region") with **no
  code that opens or posts to any group**. Those names are invented strings.
- `offscreen.js` is the same pattern with **no DOM work at all** — pure `sleep()`
  and success logs.
- The "cron" alarm (`CYNETWORK_CRON_POSTER`, every 10 minutes) is a **stub**: the
  only body is a commented-out `fetch` with the literal placeholder
  `https://YOUR_PROJECT.supabase.co/rest/v1/scheduled_posts`.

### Two more problems

**It cannot talk to the live site.** `externally_connectable` whitelists
`http://localhost:3000/*`, `https://fboosting.vercel.app/*` and
`https://*.vercel.app/*` — **`pinoyboosting.com` is not on the list.**
`background.js`'s `relayMessageToWebapp()` queries the same three patterns.

**Nothing on the site uses it.** A search of `src/` for `CHECK_EXTENSION`,
`START_AUTOMATION`, `boostsocial-bot` and `CYNETWORK` returns **zero matches**.
The extension is orphaned — no page offers it, no code calls it.

> **Risk:** a zip named "Autonomous Bot" is downloadable from a live commercial
> site and does nothing. If anyone ever installs it, it will log fabricated
> successes while posting nothing. That is a trust problem waiting to happen.

---

## 3. The ₱499 "AUTONOMOUS BOT" card — **sold, half-built, unreachable**

Verified in **both** databases and confirmed rendering on the live homepage
(`AUTONOMOUS BOT` ×2, `BUILD QUEUE` ×1 in the served HTML):

| Field | Value |
|---|---|
| Title | `AUTONOMOUS BOT` |
| Price | **₱499** |
| id | `b492aa15-b6c7-4768-988c-b1dc2778cbf9` |
| icon_type | `automation` |
| `smm_service_id` | **null** |
| `custom_fields` | `[]` |

**It is a normal purchasable card.** It is not in `utilityServiceIds`, not
PisoWiFi, and does not match the gemini/eap/tplink/software/license filters — so
it lands in `coreServices` and renders in the main grid.

### Why it cannot work

1. **`smm_service_id` is null**, and `autoPlaceRixeyOrder` stops when a service
   has no supplier ID — so nothing is ever forwarded to RixeySMM.
2. **There is no queue-building UI.** The button says **"BUILD QUEUE"** and the
   description promises *"Upload product photos, add a caption to each one,
   preview the queue in real time"* — but the card opens the **normal
   `OrderModal`**, which asks for a target URL. No uploader, no caption editor,
   no queue.
3. **The track-page viewer is dead code.** `src/app/track/page.tsx` has a full
   `parseAutonomousQueue()` that only runs when `target_url` starts with
   `"Autonomous Bot:"`. A repo-wide search finds **no code that ever writes that
   prefix** — the only match is the parser itself.

### The good news

**Zero orders have ever been placed for this service** on either database. And
the stored description has been **softened** from the old hype copy in
`scripts/add-autonomous-bot.mjs` (*"Fully automated posting... zero effort"*) to
the current, more honest *"prepare a **human-approved** publishing workflow"*.
So nobody has been misled into paying yet — but the card is still live at ₱499.

---

## 4. Database drift — **worse than a count mismatch: it is structural**

Parts 1 and 5 flagged that the two databases drift. This pass measured **which
tables are missing where**:

| Table | Master | Mirror |
|---|---|---|
| `admin_secrets` | ❌ | ✅ |
| `customer_messages` | ❌ | ✅ |
| `order_assets` | ❌ | ✅ |
| `daily_checkins` | ✅ | ❌ |
| `order_events` | ✅ | ❌ |
| `promo_codes` | ✅ | ❌ |
| `promo_redemptions` | ✅ | ❌ |
| `refill_orders` | ✅ | ❌ |

**master = 18 tables, mirror = 16, shared = 13.** Neither side is a superset.

### The money-function gap

The app's Supabase client (`NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`)
resolves to project **`qayiukxguqxewqmhfoes`** — the mirror. I confirmed the
service key's JWT `ref` claim matches that project.

| Database | Money functions present |
|---|---|
| **DigitalOcean (master)** | `confirm_paymongo_topup`, `create_api_order` — **2** |
| **Supabase (mirror)** | + `create_wallet_order`, `approve_topup_atomic`, `activate_vip_wallet_atomic` — **5** |

So the three functions the wallet checkout, top-up approval and VIP purchase
depend on **exist only on the mirror** — the database the app reads *second*.

**This works today, but only by accident.** It is the same class of luck that the
admin top-up page had before it was fixed (Part 6 / this session): the moment
anyone "tidies up" the master to be the true primary, wallet checkout breaks.

> **Note:** `create_wallet_order` is called from three routes —
> `checkout-wallet`, `orders/bulk-create` and `orders/refill`. All three depend on
> the mirror having it.

---

## 5. Customer credentials stored in plaintext — **the sharpest finding**

`orders.target_url` is a **TEXT column used as a free-form request field**. For
services that ask for credentials, the checkout serialises the answers straight
into it:

```
Custom Request: [Device #1 - EAP MAC Address: 24-2F-D0-38-C8-A7]
                [Device #1 - Username: admin]
                [Device #1 - Password: <value in plaintext>]
```

**8 rows on the master, 7 on the mirror** contain `Password:` in cleartext.

**Five services ask for credentials on their order form:**

- `EAP TPLINK ADAPTION`
- `PISOWIFI STARTER` / `PROFESSIONAL` (×2) / `ENTERPRISE`

At least one row pairs a real-looking **email address as the username** with its
password. These are the customer's router/portal admin credentials.

**Why it matters:** `target_url` is read by list views (admin orders table, track
page, customer order history) and is copied to every backup database. There is no
encryption, no masking, and no retention limit. Anyone with read access to either
database — or to a backup — has the customers' passwords.

This is not a code bug; it is a **design gap**. The custom-fields feature was
built to carry arbitrary request data and credentials were simply one of the
things customers typed into it.

---

## 6. The mobile and PWA layer — **Solid**

| Piece | State |
|---|---|
| `manifest.ts` | Standalone, portrait, icons 192/512/svg, `maskable` on 512 ✅ |
| `public/sw.js` | Network-first for pages; **network-only** for `/api`, `/admin`, non-GET and `supabase.co` — correct choice, prevents stale money data ✅ |
| Push | `push` + `notificationclick` handlers, deep-links to `/app/orders`, re-focuses an open tab ✅ |
| Capacitor | Android 8.4.0, versionName 2.1, `server.allowNavigation` now includes PayMongo hosts ✅ |

The service worker's cache exclusions are the notable good call: it would have
been easy to cache `/api` responses and show customers a stale wallet balance.

---

## 7. SEO — **Solid**

| File | Coverage |
|---|---|
| `sitemap.ts` | 8 static routes + **6 service landing pages** from `SERVICE_LANDING_PAGES` |
| `robots.ts` | Allows all, disallows `/admin`, `/admin/`, `/api/`, declares sitemap + host |
| `serviceLandingPages.ts` | 6 pages with title, description, keywords, highlights, requirements and **2 FAQs each** — Facebook, Instagram, TikTok, YouTube, PisoWiFi, Page Setup |

The landing pages are real content, not thin pages: each carries highlights,
requirements and FAQ entries, and `findServiceLandingPageForQuery()` maps a
search term to the right page.

**Gap:** `robots.ts` disallows `/api/` but **not `/app/`** — the signed-in
customer area. Those pages are behind auth so they will not index meaningfully,
but they are crawlable.

---

## 8. Repo hygiene — **agent state is committed**

| Folder | Tracked files | Size |
|---|---|---|
| `.claude/` | **240** | 1.6 MB |
| `.claude-flow/` | 15 | 21 KB |
| `.swarm/` | 3 | 179 KB |

These are AI-assistant scratch directories — agent definitions, daemon state,
`daemon.pid`, swarm metrics. **`.hormachuelos/` and `.next/` are correctly
ignored**, but these three are in version control.

Also tracked: `android-shell/` (2 files, `index.html` + `offline.html`) — a
vestigial shell, distinct from the real 1,148-file `android/` project.

And the root carries two large SMM snapshots: `rixeysmm_services.json` (287 KB)
and `rixeysmm_best.json` (4.8 KB).

---

## 9. Consolidated risk register (this pass)

| # | Finding | Severity | Reachable today? |
|---|---|---|---|
| 1 | **Customer passwords in plaintext** in `orders.target_url` (8 rows) | 🔴 High | Yes — 5 live services ask for them |
| 2 | **Chrome extension logs fabricated successes** and posts nothing | 🔴 High | Yes — downloadable from the live site |
| 3 | **₱499 AUTONOMOUS BOT** sells a queue that has no builder | 🟠 Medium | Yes — live card, but 0 orders |
| 4 | **Money RPCs exist only on the mirror** while reads prefer the master | 🟠 Medium | Works by luck |
| 5 | **Track-page queue viewer is unreachable** (nothing writes its prefix) | 🟡 Low | No — dead code |
| 6 | **Agent state committed** (`.claude/`, `.claude-flow/`, `.swarm/`) | 🟡 Low | n/a |
| 7 | **`/app/` not disallowed** in robots | 🟡 Low | n/a |
| 8 | **"Neuralwatt" naming** no longer matches any provider | 🟡 Low | n/a |

---

## 10. What is genuinely well built (this pass)

- **The AI chain's failure handling** — final-on-timeout, salvage-reasoning,
  drop-`response_format`-on-400, normalise-broken-env. Every branch has a comment
  explaining the incident that produced it.
- **The service worker's network-only list** — money data is never cached.
- **The service landing pages** — real long-tail SEO content with FAQs.
- **The PayMongo host allowlist** in the Capacitor config — the app keeps the
  checkout in-app.
- **`confirm_paymongo_topup` exists on both databases** — the payment rail is the
  one money function that was kept in sync.

---

## 11. One-line summary

The money path is the finished part; the **periphery is where the risk lives** —
a fake Chrome extension, a ₱499 card with no product behind it, and customer
passwords sitting in plaintext in a text column.
