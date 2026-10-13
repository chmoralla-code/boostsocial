-- ─────────────────────────────────────────────────────────────
-- Reseller API — keys, request log, and the atomic order RPC.
--
-- Design: docs/reseller-api-plan.md
--
-- Scope: a reseller creates a key on the site, funds their wallet
-- with PayMongo, and places orders from their own website. A key can
-- only ever spend its OWN wallet, so a stolen key cannot touch the
-- platform's money or another reseller's.
--
-- Mirrors the existing money pattern:
--   * pricing resolved server-side, never trusted from the client
--   * caps + balance checked inside the SAME transaction as the debit
--   * one SECURITY DEFINER RPC, service_role only
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,                  -- owner: the wallet that gets debited
  label TEXT NOT NULL DEFAULT 'Default key',
  key_prefix TEXT NOT NULL,               -- shown in the UI, e.g. pbk_1a2b3c4d
  key_hash TEXT NOT NULL UNIQUE,          -- sha256 of the full key; the plain key is never stored
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  -- Spend caps in pesos. NULL = no cap. Checked inside the debit transaction.
  daily_limit NUMERIC(12, 2),
  monthly_limit NUMERIC(12, 2),
  spent_day NUMERIC(12, 2) NOT NULL DEFAULT 0,
  spent_day_start DATE NOT NULL DEFAULT CURRENT_DATE,
  spent_month NUMERIC(12, 2) NOT NULL DEFAULT 0,
  spent_month_start DATE NOT NULL DEFAULT date_trunc('month', CURRENT_DATE)::date,

  -- Request rate limit: a fixed one-minute window, counted in the database
  -- so it survives cold starts and is shared across every server instance.
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  window_count INTEGER NOT NULL DEFAULT 0,
  window_limit INTEGER NOT NULL DEFAULT 60,

  allowed_ips JSONB,                      -- optional allowlist; NULL = any IP
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);

-- No anon/authenticated policies on purpose: service_role only,
-- exactly like the other money tables (see admin_secrets).
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────
-- Order attribution
-- ─────────────────────────────────────────────────────────────
ALTER TABLE orders ADD COLUMN IF NOT EXISTS api_key_id UUID;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'web';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- A retried `add` with the same idempotency key must never create a second
-- order. This unique index is what makes that guarantee hold under load.
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_api_idempotency
  ON orders(api_key_id, idempotency_key)
  WHERE api_key_id IS NOT NULL AND idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_api_key ON orders(api_key_id);

-- ─────────────────────────────────────────────────────────────
-- Audit trail — what you read when a reseller disputes a charge.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_request_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  api_key_id UUID REFERENCES api_keys(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  order_id UUID,
  ip TEXT,
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_request_log_key
  ON api_request_log(api_key_id, created_at DESC);

ALTER TABLE api_request_log ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────
-- create_api_order
--
-- Verifies the key, enforces rate + spend caps, then debits the wallet
-- and creates the order in ONE transaction. Returns an error_code instead
-- of raising, so the API can answer with a clean message per case.
--
-- Safe to call twice with the same idempotency key: the second call
-- returns the original order with replayed = TRUE.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION create_api_order(
  p_key_id UUID,
  p_service_id UUID,
  p_service_title TEXT,
  p_customer_email TEXT,
  p_target_url TEXT,
  p_amount NUMERIC,
  p_quantity INTEGER,
  p_smm_service_id TEXT,
  p_original_amount NUMERIC,
  p_idempotency_key TEXT,
  p_ip TEXT
)
RETURNS TABLE(
  order_id UUID,
  new_balance NUMERIC,
  replayed BOOLEAN,
  error_code TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key api_keys;
  v_balance NUMERIC;
  v_order_id UUID;
  v_existing UUID;
  v_next_count INTEGER;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN QUERY SELECT NULL::UUID, NULL::NUMERIC, FALSE, 'INVALID_AMOUNT';
    RETURN;
  END IF;

  -- 1. Lock the key row: everything below is serialised per key.
  SELECT * INTO v_key FROM api_keys WHERE id = p_key_id FOR UPDATE;

  IF v_key.id IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, NULL::NUMERIC, FALSE, 'INVALID_KEY';
    RETURN;
  END IF;

  IF NOT v_key.is_active OR v_key.revoked_at IS NOT NULL THEN
    RETURN QUERY SELECT NULL::UUID, NULL::NUMERIC, FALSE, 'KEY_REVOKED';
    RETURN;
  END IF;

  -- 2. Idempotency: a retried request returns the original order.
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing
      FROM orders
     WHERE api_key_id = p_key_id
       AND idempotency_key = p_idempotency_key
     LIMIT 1;

    IF v_existing IS NOT NULL THEN
      SELECT balance INTO v_balance FROM profiles WHERE id = v_key.user_id;
      RETURN QUERY SELECT v_existing, v_balance, TRUE, NULL::TEXT;
      RETURN;
    END IF;
  END IF;

  -- 3. Rate limit — fixed one-minute window, stored on the key.
  IF v_key.window_start < NOW() - INTERVAL '1 minute' THEN
    v_next_count := 1;
  ELSE
    v_next_count := v_key.window_count + 1;
  END IF;

  IF v_next_count > v_key.window_limit THEN
    -- Count the rejected hit so a hammering script cannot reset the window.
    UPDATE api_keys SET window_count = v_next_count WHERE id = v_key.id;
    RETURN QUERY SELECT NULL::UUID, NULL::NUMERIC, FALSE, 'RATE_LIMITED';
    RETURN;
  END IF;

  -- 4. Spend caps, with day / month rollover.
  IF v_key.spent_day_start <> CURRENT_DATE THEN
    v_key.spent_day := 0;
    v_key.spent_day_start := CURRENT_DATE;
  END IF;

  IF date_trunc('month', v_key.spent_month_start) <> date_trunc('month', CURRENT_DATE) THEN
    v_key.spent_month := 0;
    v_key.spent_month_start := date_trunc('month', CURRENT_DATE)::date;
  END IF;

  IF v_key.daily_limit IS NOT NULL AND (v_key.spent_day + p_amount) > v_key.daily_limit THEN
    UPDATE api_keys
       SET window_count = v_next_count, last_used_at = NOW()
     WHERE id = v_key.id;
    RETURN QUERY SELECT NULL::UUID, NULL::NUMERIC, FALSE, 'DAILY_LIMIT';
    RETURN;
  END IF;

  IF v_key.monthly_limit IS NOT NULL AND (v_key.spent_month + p_amount) > v_key.monthly_limit THEN
    UPDATE api_keys
       SET window_count = v_next_count, last_used_at = NOW()
     WHERE id = v_key.id;
    RETURN QUERY SELECT NULL::UUID, NULL::NUMERIC, FALSE, 'MONTHLY_LIMIT';
    RETURN;
  END IF;

  -- 5. The wallet must cover it. Locked, so two calls cannot both pass.
  SELECT balance INTO v_balance
    FROM profiles
   WHERE id = v_key.user_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::UUID, NULL::NUMERIC, FALSE, 'NO_PROFILE';
    RETURN;
  END IF;

  IF COALESCE(v_balance, 0) < p_amount THEN
    UPDATE api_keys
       SET window_count = v_next_count, last_used_at = NOW()
     WHERE id = v_key.id;
    RETURN QUERY SELECT NULL::UUID, v_balance, FALSE, 'INSUFFICIENT_BALANCE';
    RETURN;
  END IF;

  -- 6. Create the order, already Processing — no admin approval step.
  INSERT INTO orders (
    service_id,
    service_title,
    customer_email,
    target_url,
    amount,
    status,
    payment_method,
    quantity,
    smm_service_id,
    original_amount,
    api_key_id,
    source,
    idempotency_key
  ) VALUES (
    p_service_id,
    p_service_title,
    trim(p_customer_email),
    trim(p_target_url),
    p_amount,
    'Processing',
    'Wallet',
    p_quantity,
    p_smm_service_id,
    p_original_amount,
    p_key_id,
    'api',
    p_idempotency_key
  )
  RETURNING id INTO v_order_id;

  -- 7. Debit and bump the counters.
  UPDATE profiles
     SET balance = COALESCE(balance, 0) - p_amount
   WHERE id = v_key.user_id
   RETURNING balance INTO v_balance;

  UPDATE api_keys
     SET window_start = CASE WHEN window_start < NOW() - INTERVAL '1 minute' THEN NOW() ELSE window_start END,
         window_count = v_next_count,
         spent_day = v_key.spent_day + p_amount,
         spent_day_start = v_key.spent_day_start,
         spent_month = v_key.spent_month + p_amount,
         spent_month_start = v_key.spent_month_start,
         last_used_at = NOW()
   WHERE id = v_key.id;

  INSERT INTO api_request_log (api_key_id, action, order_id, ip, detail)
  VALUES (p_key_id, 'add', v_order_id, p_ip, format('debited %s', p_amount));

  RETURN QUERY SELECT v_order_id, v_balance, FALSE, NULL::TEXT;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- touch_api_key
-- Records a non-spending call (services / balance / status / refill)
-- and enforces the same per-key rate limit.
-- Returns TRUE when the call is allowed.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION touch_api_key(
  p_key_id UUID,
  p_action TEXT,
  p_ip TEXT
)
RETURNS TABLE(allowed BOOLEAN, user_id UUID, error_code TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key api_keys;
  v_next_count INTEGER;
BEGIN
  SELECT * INTO v_key FROM api_keys WHERE id = p_key_id FOR UPDATE;

  IF v_key.id IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 'INVALID_KEY';
    RETURN;
  END IF;

  IF NOT v_key.is_active OR v_key.revoked_at IS NOT NULL THEN
    RETURN QUERY SELECT FALSE, v_key.user_id, 'KEY_REVOKED';
    RETURN;
  END IF;

  IF v_key.window_start < NOW() - INTERVAL '1 minute' THEN
    v_next_count := 1;
  ELSE
    v_next_count := v_key.window_count + 1;
  END IF;

  IF v_next_count > v_key.window_limit THEN
    UPDATE api_keys SET window_count = v_next_count WHERE id = v_key.id;
    RETURN QUERY SELECT FALSE, v_key.user_id, 'RATE_LIMITED';
    RETURN;
  END IF;

  UPDATE api_keys
     SET window_start = CASE WHEN window_start < NOW() - INTERVAL '1 minute' THEN NOW() ELSE window_start END,
         window_count = v_next_count,
         last_used_at = NOW()
   WHERE id = v_key.id;

  INSERT INTO api_request_log (api_key_id, action, ip)
  VALUES (p_key_id, p_action, p_ip);

  RETURN QUERY SELECT TRUE, v_key.user_id, NULL::TEXT;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- Lock both RPCs to the server key.
--
-- Supabase provides the anon / authenticated / service_role roles; a plain
-- Postgres such as the DigitalOcean master does not have them, so guard on
-- the role's existence instead of failing the whole migration there.
-- ─────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION create_api_order(UUID, UUID, TEXT, TEXT, TEXT, NUMERIC, INTEGER, TEXT, NUMERIC, TEXT, TEXT) FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION create_api_order(UUID, UUID, TEXT, TEXT, TEXT, NUMERIC, INTEGER, TEXT, NUMERIC, TEXT, TEXT) TO service_role';
    EXECUTE 'REVOKE ALL ON FUNCTION touch_api_key(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION touch_api_key(UUID, TEXT, TEXT) TO service_role';
  ELSE
    EXECUTE 'REVOKE ALL ON FUNCTION create_api_order(UUID, UUID, TEXT, TEXT, TEXT, NUMERIC, INTEGER, TEXT, NUMERIC, TEXT, TEXT) FROM PUBLIC';
    EXECUTE 'REVOKE ALL ON FUNCTION touch_api_key(UUID, TEXT, TEXT) FROM PUBLIC';
  END IF;
END $$;
