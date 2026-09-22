# PinoyBoosting conversation notes

**Project:** `boostsocial` → [pinoyboosting.com](https://pinoyboosting.com)  
**Vercel project:** `boostsocial` (`prj_SdfICbZ1V5zQpwTQ126cdc47ccas`)  
**Session span:** ~Jul 23–29, 2026  
**Transcript:** [Auth, catalog, approvals](cfbd14c4-a377-4fb9-8dda-b7e157848b14)

---

## Summary

Work in this conversation covered auth/email delivery (Resend), password recovery, UI loading freezes, live SMM catalog (Rixey), post-approval/completion customer emails, and AI auto-approval of GCash receipts for Telegram top-up and order flows.

---

## 1. Account creation — OTP email not arriving

### Problem
After signup, users did not receive confirmation OTP emails. The UI could still claim a code was sent.

### Cause
- Custom OTP via **Resend** (`RESEND_API_KEY`), not Supabase’s built-in confirmation mailer
- Production was missing / misconfigured `RESEND_API_KEY`
- Signup created users with `email_confirm: false`; client called `/api/auth/send-otp` and often ignored failures
- User lookup via paginated `listUsers` was slow/fragile

### Fixes
| Area | Location |
|------|----------|
| Shared OTP send helper | `src/utils/auth/otp.ts` |
| Faster email lookup | `src/utils/auth/find-user.ts` |
| Auth email sender | `src/utils/auth/email.ts` |
| Signup / send-otp / verify-otp | `src/app/api/auth/*` |

- Domain `pinoyboosting.com` verified in Resend  
- Branding: **CYNETWORK → PINOYBOOSTING**  
- From: `PINOYBOOSTING <noreply@pinoyboosting.com>`

---

## 2. Forgot password

### Problem
Reset email returned 200, but the link led to unauthorized / failed session (`/auth/callback` without a usable recovery session).

### Fixes
- `src/app/api/auth/forgot-password/route.ts` — Resend email with `/auth/confirm?token_hash=...&type=recovery&next=/reset-password`
- New `src/app/auth/confirm/route.ts` — `verifyOtp` then redirect
- Hardened `src/app/auth/callback/route.ts` and `src/app/reset-password/page.tsx`

---

## 3. Desktop loading animations freezing

### Problem
Login “Creating…” letter-bounce, rotating blurred glow blobs, and a global `* { transition }` fought CSS animations.

### Fixes
- Login uses `Loader2` + mode labels + `btn-loading-shimmer`
- `globals.css` blob keyframes translate-only; scoped transitions so spin/shimmer aren’t blocked

---

## 4. All Services / SMM #118 “temporarily unavailable”

### Problem
Catalog UI showed stale service **#118**; orders failed with provider unavailable.

### Cause
- Catalog fell back to **stored Supabase snapshot** (~12 services) instead of live Rixey
- Production `RIXEYSMM_API_KEY` was empty at times
- Live Rixey (~925 services) **no longer lists #118**
- Live fetch often takes **~6–12s**; old code aborted at **2.5s** and preferred the stale DB catalog whenever it had rows

### Fixes
- Prefer **live Rixey** when API key is set (`src/lib/smmCatalog.ts`)
- Longer catalog timeout (~15s); required pricing check ~16s (`src/lib/orderPricing.ts`)
- Client `catalogSnapshot` fallback on create/wallet when needed
- Set `RIXEYSMM_API_KEY` on Vercel production/development

### Facebook Followers alternatives (examples)
- Mix accounts: **1071–1074**
- Profile/Page: **1048–1051**

Do **not** use delisted **#118**.

> ⚠️ **Superseded — see the 2026-09-22 addendum below.** #118 has since returned
> to the live RixeySMM catalog (10.93 PHP/1k) and is no longer blocked in
> `src/lib/chatOffers.ts`. The live catalog now spans ids **4–1376** with
> **1079** services, and the specific ids listed above are only examples —
> always resolve against the live catalog rather than a hardcoded id.

---

## 5. Email system used for auth

| Flow | Provider |
|------|----------|
| Create account (OTP) | **Resend** |
| Forgot password | **Resend** |
| Auth users store | **Supabase Auth** |

Helper: `src/utils/auth/email.ts`  
Env: `RESEND_API_KEY`

---

## 6. Email after Telegram / admin approval

### Request
After approving an **order** or **top-up** (Telegram, and admin for parity), email the client’s registered address with a message like “Request received, Enjoy the services!” plus light upsell.

### Implementation
- `src/lib/approvalEmails.ts` — `sendOrderApprovedEmail`, `sendTopupApprovedEmail`
- Wired in:
  - `src/app/api/telegram/webhook/route.ts`
  - `src/app/api/admin/approve-topup/route.ts`
  - `src/app/api/admin/update-order-status/route.ts` (when status → `Processing`)

Pushed commit example: `6d532e4` — *feat: email clients after approval and prefer live Rixey catalog*

---

## 7. Email when order is Completed

### Implementation
- `sendOrderCompletedEmail` in `src/lib/approvalEmails.ts`
- Fired when status becomes **Completed** from:
  - Admin `update-order-status`
  - Provider sync `sync-external-orders`

Subject/body thank the client and invite another order (“Order again”).

---

## 8. AI auto-approve payment proofs (Telegram top-up & order)

### Request
Auto-approve when the receipt AI detects:

1. GCash **receiver** is **`HE•••Y S.`** / `HE...Y S.` (or unmasked **Henry S.**)
2. Or, for an InstaPay / bank-transfer proof sent to the same GCash account, the visible destination shows **Henry**, **G-Xchange / GCash**, and an account/phone ending **`9963`**
3. **Payment reference** is present and **unique** (not reused on another active top-up/order). Alpha prefixes from bank rails are preserved.
4. (Also enforced) **Amount** matches request within tolerance; reject obvious AI-generated fakes

This accepts the payment rail used in an InstaPay/bank-to-GCash confirmation without accepting arbitrary bank screenshots. Direct GCash receipts continue to use the original masked/unmasked receiver-name rule.

### Implementation
| Piece | Path |
|-------|------|
| Vision verify + auto-approve | `src/lib/receiptVerifier.ts` |
| Image-hash duplicate guard | `src/lib/receiptGuard.ts` |
| Top-up create + AI | `src/app/api/topup/create/route.ts` |
| Order receipt upload + AI | `src/app/api/upload-receipt/route.ts` |
| Telegram captions (AUTO-APPROVED) | `src/lib/telegram.ts` |
| DB columns | `supabase/migrations/20260729000000_add_gcash_reference.sql` |

**Columns added:** `topups.gcash_reference`, `orders.gcash_reference`, `orders.receipt_data` (applied on production DB).

**On auto-approve match**
- Top-up → atomic credit; Telegram audit (no Approve button); customer notify + Resend email  
- Order → `Processing`; Rixey place; referral; customer email; Telegram **AUTO-APPROVED** (no Approve button)

**Otherwise** → pending for manual Telegram approve/reject as before.

Site GCash payee shown in UI: **09505339963 • Henry S.**

---

## Key env vars (names only)

| Variable | Purpose |
|----------|---------|
| `RESEND_API_KEY` | Auth + approval/completion emails |
| `RIXEYSMM_API_KEY` | Live SMM catalog + order placement |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Server admin client |
| `TELEGRAM_WEBHOOK_SECRET` | Telegram webhook auth |
| `OPENCODE_ZEN_API_KEY` / `OPENROUTER_API_KEY` / `GEMINI_API_KEY` | Receipt vision model |

**Never commit secrets.** Rotate any keys that were pasted in chat.

---

## Useful paths (quick index)

```
src/utils/auth/email.ts
src/utils/auth/otp.ts
src/utils/auth/find-user.ts
src/app/api/auth/signup|send-otp|forgot-password|verify-otp
src/app/auth/confirm/route.ts
src/lib/smmCatalog.ts
src/lib/orderPricing.ts
src/lib/approvalEmails.ts
src/lib/receiptVerifier.ts
src/lib/receiptGuard.ts
src/lib/telegram.ts
src/app/api/telegram/webhook/route.ts
src/app/api/topup/create/route.ts
src/app/api/upload-receipt/route.ts
src/app/api/admin/update-order-status/route.ts
src/app/api/admin/sync-external-orders/route.ts
```

---

## Ops checklist

- [x] Resend configured for production (`pinoyboosting.com`)
- [x] Live Rixey catalog (~925 services) when key set
- [x] Approval emails on order/top-up approve
- [x] Completion emails on order Completed
- [x] AI auto-approve for matching GCash destination + unique payment reference (including InstaPay/bank transfers to that GCash account)
- [ ] Optionally re-sync admin service mappings that still point at delisted IDs (e.g. #118)

---

## Addendum — 2026-09-22 (RixeySMM re-debug)

Re-verified the provider integration end to end.

### Provider status
- Endpoint `https://rixeysmm.shop/api/v2` responding normally; root site HTTP 200.
- `RIXEYSMM_API_KEY` valid — `action=balance` → **₱448.43 PHP**.
- `action=services` → **1079 services**, ids **4–1376**, ~5.4s cold fetch.

### What was actually broken
1. `RIXEYSMM_API_KEY` was **absent from `.env.local`** entirely, so local dev
   silently fell back to the stored catalog and every order failed placement.
   It now has to exist on Vercel for production too.
2. **Twelve hardcoded provider ids were delisted**:
   `fbReactions.ts` — `2860`, `3021–3026`, `1961–1965`; `orderPricing.ts` /
   `order-page/page.tsx` — `CUSTOM_PAGE_SMM_ID` = `2026`.
   Every Facebook reaction order was failing at placement because of this.

### Fixes applied
| File | Change |
|------|--------|
| `src/utils/fbReactions.ts` | Remapped to live `#1086–#1092` (all 7 reaction types, uniform 5.80 PHP/1k). Multi-reaction selections now report `isMixed` / `smmId: null`. |
| `src/lib/orderPricing.ts` | Rejects mixed-reaction orders with a clear message (no provider service exists for a specific mix). |
| `src/components/OrderModal.tsx` | Reaction picker is single-select; id resolution is null-safe. |
| `src/app/api/smm/balance/route.ts` | Distinguishes `missing_key` / `provider_error` / `network_error` / `ok`; low-balance alert only fires on a successful read. |
| `src/lib/chatOffers.ts` | `118` unblocked (it is live again); blocklist documented as an empty safety net. |
| `.env.local` | `RIXEYSMM_API_KEY` added (gitignored — still set it on Vercel). |
| `src/middleware.ts` → `src/proxy.ts` | Next.js 16 renamed Middleware to Proxy; official codemod equivalent applied. |
| `next.config.ts` | `turbopack.root` pinned to the project root (stray lockfile in the home dir confused root detection). |

### Cost impact
The old Like rate was 4.49 and other reactions 5.68. The live replacement
family is a uniform **5.80**, so retail prices rise ~29% for Like and ~2% for
the rest (× your markup multiplier). Worth re-checking margins.

### Still open
- `CUSTOM_PAGE_SMM_ID = "2026"` is delisted and RixeySMM offers **no**
  equivalent "custom Facebook page" service. Custom-page orders cannot be
  placed automatically — needs a business decision (re-map, re-scope, or make
  it manual fulfilment).
- Reaction orders now work for a **single** reaction type only.
- `.env.local` still has no Supabase variables, so DB-backed pages fail locally.
- [ ] Keep Resend / Rixey keys rotated if exposed in chat history
