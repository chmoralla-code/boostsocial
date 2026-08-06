-- Feature Suite: promo codes, order events timeline, daily check-ins, refill orders
-- Idempotent — safe to run on DigitalOcean primary + every Supabase backup.

-- ─────────────────────────────────────────────────────────────
-- 1. Promo codes
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS promo_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  discount_percent NUMERIC NOT NULL DEFAULT 0,
  discount_amount NUMERIC NOT NULL DEFAULT 0,
  max_uses INTEGER NOT NULL DEFAULT 1,
  used_count INTEGER NOT NULL DEFAULT 0,
  min_order_amount NUMERIC NOT NULL DEFAULT 0,
  applies_to TEXT NOT NULL DEFAULT 'all',
  expires_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS promo_redemptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL,
  order_id UUID NOT NULL,
  customer_email TEXT NOT NULL,
  discount_amount NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(order_id)
);

-- Service-role only (same pattern as admin_secrets: RLS on, no policies).
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_redemptions ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────
-- 2. Order events (status history / timeline)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  detail TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_events_order ON order_events(order_id, created_at);
ALTER TABLE order_events ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────
-- 3. Daily check-ins
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_checkins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  checkin_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reward NUMERIC NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, checkin_date)
);

ALTER TABLE daily_checkins ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────
-- 4. Refill orders (re-order an existing completed order)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refill_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  original_order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  customer_email TEXT NOT NULL,
  service_id UUID,
  smm_service_id TEXT,
  target_url TEXT,
  quantity INTEGER,
  amount NUMERIC,
  status TEXT NOT NULL DEFAULT 'pending',
  smm_order_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(original_order_id)
);

ALTER TABLE refill_orders ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────
-- 5. New orders columns (idempotent ALTERs)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE orders ADD COLUMN IF NOT EXISTS promo_code TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS promo_discount_amount NUMERIC DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ;

-- ─────────────────────────────────────────────────────────────
-- 6. New profiles column (low-balance alert guard)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_low_balance_alert_at TIMESTAMPTZ;

-- ─────────────────────────────────────────────────────────────
-- 7. Atomic wallet credit RPC (check-in rewards, promo cashback, etc.)
-- Mirrors approve_topup_atomic: row lock + SECURITY DEFINER + service_role only.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION credit_wallet_atomic(
  p_user_id UUID,
  p_amount NUMERIC,
  p_reason TEXT
)
RETURNS TABLE(new_balance NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance NUMERIC;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid credit amount';
  END IF;

  SELECT balance INTO v_balance
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer profile was not found';
  END IF;

  UPDATE profiles
  SET balance = COALESCE(balance, 0) + p_amount
  WHERE id = p_user_id
  RETURNING balance INTO v_balance;

  RETURN QUERY SELECT v_balance;
END;
$$;

REVOKE ALL ON FUNCTION credit_wallet_atomic(UUID, NUMERIC, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION credit_wallet_atomic(UUID, NUMERIC, TEXT) TO service_role;
