-- ─────────────────────────────────────────────────────────────
-- PayMongo wallet top-up rail (test-mode first)
--
-- Scope: wallet top-up ONLY. PayMongo never pays for an order
-- directly, so a disputed boost never touches the gateway.
--
-- Mirrors the existing money pattern:
--   * amounts resolved server-side, stored in centavos
--   * a UNIQUE event id makes the webhook idempotent
--   * one SECURITY DEFINER RPC does lock + credit + status flip
--     in a single transaction (service_role only)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS paymongo_topups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  -- The linked topups row that actually gets credited + shows in admin.
  topup_id UUID REFERENCES topups(id) ON DELETE SET NULL,
  amount NUMERIC(10, 2) NOT NULL,        -- pesos, for display
  amount_centavos INTEGER NOT NULL,      -- what we asked PayMongo to charge
  payment_method TEXT,                   -- gcash | maya | qrph
  checkout_session_id TEXT,              -- cs_... from PayMongo
  payment_intent_id TEXT,
  paymongo_payment_id TEXT,              -- pay_... once paid
  paymongo_event_id TEXT UNIQUE,         -- idempotency anchor
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','paid','failed','expired','amount_mismatch','cancelled')),
  raw_event JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);

-- One open session per client key is enough; session ids stay unique when present.
CREATE UNIQUE INDEX IF NOT EXISTS idx_paymongo_topups_session
  ON paymongo_topups(checkout_session_id)
  WHERE checkout_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_paymongo_topups_topup ON paymongo_topups(topup_id);
CREATE INDEX IF NOT EXISTS idx_paymongo_topups_user ON paymongo_topups(user_id);
CREATE INDEX IF NOT EXISTS idx_paymongo_topups_event ON paymongo_topups(paymongo_event_id);

ALTER TABLE paymongo_topups ENABLE ROW LEVEL SECURITY;
-- No anon/authenticated policies on purpose: service_role only,
-- exactly like the other money tables.

-- ─────────────────────────────────────────────────────────────
-- confirm_paymongo_topup
-- Marks the gateway payment paid AND credits the wallet in one
-- transaction. Safe to call twice with the same event: the second
-- call sees status='paid' and returns confirmed = FALSE.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION confirm_paymongo_topup(
  p_checkout_session_id TEXT,
  p_event_id TEXT,
  p_centavos INTEGER,
  p_method TEXT,
  p_payment_id TEXT,
  p_raw JSONB
)
RETURNS TABLE(
  confirmed BOOLEAN,
  topup_id UUID,
  user_id UUID,
  amount NUMERIC,
  new_balance NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row paymongo_topups;
  v_topup_status TEXT;
  v_new_balance NUMERIC;
BEGIN
  -- 1. Lock our own row. Prefer the session id; fall back to the event id.
  IF p_checkout_session_id IS NOT NULL THEN
    SELECT * INTO v_row FROM paymongo_topups
     WHERE checkout_session_id = p_checkout_session_id
     FOR UPDATE;
  END IF;

  IF v_row.id IS NULL THEN
    SELECT * INTO v_row FROM paymongo_topups
     WHERE paymongo_event_id = p_event_id
     FOR UPDATE;
  END IF;

  IF v_row.id IS NULL THEN
    -- Unknown payment. Refuse rather than guess a customer.
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::UUID, NULL::NUMERIC, NULL::NUMERIC;
    RETURN;
  END IF;

  -- 2. Idempotency: a retried webhook must never credit twice.
  IF v_row.status = 'paid' THEN
    RETURN QUERY SELECT FALSE, v_row.topup_id, v_row.user_id, v_row.amount, NULL::NUMERIC;
    RETURN;
  END IF;

  -- 3. The paid amount must equal the amount we resolved server-side.
  IF v_row.amount_centavos <> p_centavos THEN
    UPDATE paymongo_topups
       SET status = 'amount_mismatch',
           raw_event = p_raw,
           paymongo_event_id = COALESCE(paymongo_event_id, p_event_id)
     WHERE id = v_row.id;

    RETURN QUERY SELECT FALSE, v_row.topup_id, v_row.user_id, v_row.amount, NULL::NUMERIC;
    RETURN;
  END IF;

  -- 4. Mark this gateway payment paid.
  UPDATE paymongo_topups
     SET status = 'paid',
         paid_at = NOW(),
         payment_method = COALESCE(p_method, payment_method),
         paymongo_event_id = COALESCE(paymongo_event_id, p_event_id),
         paymongo_payment_id = COALESCE(p_payment_id, paymongo_payment_id),
         raw_event = p_raw
   WHERE id = v_row.id;

  -- 5. Flip the linked top-up and credit the wallet, but ONLY if it is
  --    still pending. If an admin already approved it (or rejected it),
  --    we leave the balance alone — no double credit, no silent loss.
  IF v_row.topup_id IS NOT NULL THEN
    SELECT status INTO v_topup_status
      FROM topups
     WHERE id = v_row.topup_id
     FOR UPDATE;

    IF v_topup_status = 'pending' THEN
      UPDATE profiles
         SET balance = COALESCE(balance, 0) + v_row.amount
       WHERE id = v_row.user_id
       RETURNING balance INTO v_new_balance;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Customer profile was not found';
      END IF;

      UPDATE topups
         SET status = 'approved',
             amount = v_row.amount,
             reviewed_at = NOW(),
             reviewed_by = 'PayMongo'
       WHERE id = v_row.topup_id;
    END IF;
  END IF;

  RETURN QUERY SELECT TRUE, v_row.topup_id, v_row.user_id, v_row.amount, v_new_balance;
END;
$$;

-- Lock the RPC down to the server key, exactly like the other money functions.
-- Supabase provides the anon / authenticated / service_role roles; a plain
-- Postgres such as the DigitalOcean master does not have them, so guard on the
-- role's existence instead of failing the whole migration there.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION confirm_paymongo_topup(TEXT, TEXT, INTEGER, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION confirm_paymongo_topup(TEXT, TEXT, INTEGER, TEXT, TEXT, JSONB) TO service_role';
  ELSE
    EXECUTE 'REVOKE ALL ON FUNCTION confirm_paymongo_topup(TEXT, TEXT, INTEGER, TEXT, TEXT, JSONB) FROM PUBLIC';
  END IF;
END $$;
