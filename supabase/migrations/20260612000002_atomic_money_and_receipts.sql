ALTER TABLE orders ADD COLUMN IF NOT EXISTS receipt_hash TEXT;
ALTER TABLE vip_subscriptions ADD COLUMN IF NOT EXISTS receipt_hash TEXT;
ALTER TABLE topups ADD COLUMN IF NOT EXISTS receipt_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_receipt_hash ON orders(receipt_hash);
CREATE INDEX IF NOT EXISTS idx_vip_subscriptions_receipt_hash ON vip_subscriptions(receipt_hash);
CREATE INDEX IF NOT EXISTS idx_topups_receipt_hash ON topups(receipt_hash);

CREATE TABLE IF NOT EXISTS order_assets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('profile', 'cover')),
  content_type TEXT NOT NULL,
  data_url TEXT,
  storage_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(order_id, asset_type)
);

ALTER TABLE order_assets ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION create_wallet_order(
  p_user_id UUID,
  p_existing_order_id UUID,
  p_service_id UUID,
  p_service_title TEXT,
  p_customer_email TEXT,
  p_target_url TEXT,
  p_amount NUMERIC,
  p_quantity INTEGER,
  p_smm_service_id TEXT,
  p_original_amount NUMERIC,
  p_vip_plan TEXT,
  p_vip_discount_percent NUMERIC,
  p_vip_discount_amount NUMERIC
)
RETURNS TABLE(order_id UUID, new_balance NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance NUMERIC;
  v_order_id UUID;
  v_order_status TEXT;
  v_order_email TEXT;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid wallet checkout amount';
  END IF;

  SELECT balance INTO v_balance
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer profile was not found';
  END IF;

  IF COALESCE(v_balance, 0) < p_amount THEN
    RAISE EXCEPTION 'Insufficient wallet balance';
  END IF;

  IF p_existing_order_id IS NOT NULL THEN
    SELECT status, customer_email INTO v_order_status, v_order_email
    FROM orders
    WHERE id = p_existing_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Pending order was not found';
    END IF;

    IF lower(trim(COALESCE(v_order_email, ''))) <> lower(trim(COALESCE(p_customer_email, ''))) THEN
      RAISE EXCEPTION 'Wallet order email does not match the pending order';
    END IF;

    IF v_order_status <> 'Pending' THEN
      RAISE EXCEPTION 'Only pending orders can be paid with wallet';
    END IF;

    UPDATE orders
    SET service_id = p_service_id,
        service_title = p_service_title,
        customer_email = trim(p_customer_email),
        target_url = trim(p_target_url),
        amount = p_amount,
        status = 'Processing',
        payment_method = 'Wallet',
        quantity = p_quantity,
        smm_service_id = p_smm_service_id,
        original_amount = p_original_amount,
        vip_plan = p_vip_plan,
        vip_discount_percent = COALESCE(p_vip_discount_percent, 0),
        vip_discount_amount = COALESCE(p_vip_discount_amount, 0)
    WHERE id = p_existing_order_id
    RETURNING id INTO v_order_id;
  ELSE
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
      vip_plan,
      vip_discount_percent,
      vip_discount_amount
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
      p_vip_plan,
      COALESCE(p_vip_discount_percent, 0),
      COALESCE(p_vip_discount_amount, 0)
    )
    RETURNING id INTO v_order_id;
  END IF;

  UPDATE profiles
  SET balance = COALESCE(balance, 0) - p_amount
  WHERE id = p_user_id
  RETURNING balance INTO v_balance;

  RETURN QUERY SELECT v_order_id, v_balance;
END;
$$;

REVOKE ALL ON FUNCTION create_wallet_order(UUID, UUID, UUID, TEXT, TEXT, TEXT, NUMERIC, INTEGER, TEXT, NUMERIC, TEXT, NUMERIC, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION create_wallet_order(UUID, UUID, UUID, TEXT, TEXT, TEXT, NUMERIC, INTEGER, TEXT, NUMERIC, TEXT, NUMERIC, NUMERIC) TO service_role;

CREATE OR REPLACE FUNCTION approve_topup_atomic(
  p_topup_id UUID,
  p_amount NUMERIC,
  p_reviewed_by TEXT
)
RETURNS TABLE(user_id UUID, email TEXT, amount NUMERIC, new_balance NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_email TEXT;
  v_status TEXT;
  v_amount NUMERIC;
  v_new_balance NUMERIC;
BEGIN
  SELECT t.user_id, t.email, t.status, t.amount INTO v_user_id, v_email, v_status, v_amount
  FROM topups t
  WHERE t.id = p_topup_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Top-up request not found';
  END IF;

  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'Top-up is already %', v_status;
  END IF;

  v_amount := COALESCE(p_amount, v_amount);
  IF v_amount IS NULL OR v_amount < 0 THEN
    RAISE EXCEPTION 'Amount must be a non-negative number';
  END IF;

  UPDATE profiles
  SET balance = COALESCE(balance, 0) + v_amount
  WHERE id = v_user_id
  RETURNING balance INTO v_new_balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  UPDATE topups
  SET status = 'approved',
      amount = v_amount,
      reviewed_at = NOW(),
      reviewed_by = COALESCE(p_reviewed_by, 'admin')
  WHERE id = p_topup_id;

  RETURN QUERY SELECT v_user_id, v_email, v_amount, v_new_balance;
END;
$$;

REVOKE ALL ON FUNCTION approve_topup_atomic(UUID, NUMERIC, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION approve_topup_atomic(UUID, NUMERIC, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION activate_vip_wallet_atomic(
  p_user_id UUID,
  p_email TEXT,
  p_plan_code TEXT,
  p_amount NUMERIC,
  p_vip_started_at TIMESTAMPTZ,
  p_vip_expires_at TIMESTAMPTZ,
  p_notes TEXT
)
RETURNS TABLE(subscription_id UUID, new_balance NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance NUMERIC;
  v_subscription_id UUID;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid VIP amount';
  END IF;

  SELECT balance INTO v_balance
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF COALESCE(v_balance, 0) < p_amount THEN
    RAISE EXCEPTION 'Wallet balance is insufficient';
  END IF;

  INSERT INTO vip_subscriptions (
    user_id,
    email,
    plan_code,
    payment_method,
    amount,
    status,
    notes,
    reviewed_at,
    reviewed_by
  ) VALUES (
    p_user_id,
    trim(p_email),
    p_plan_code,
    'Wallet',
    p_amount,
    'approved',
    p_notes,
    NOW(),
    'system'
  )
  RETURNING id INTO v_subscription_id;

  UPDATE profiles
  SET balance = COALESCE(balance, 0) - p_amount,
      vip_plan = p_plan_code,
      vip_started_at = p_vip_started_at,
      vip_expires_at = p_vip_expires_at
  WHERE id = p_user_id
  RETURNING balance INTO v_balance;

  RETURN QUERY SELECT v_subscription_id, v_balance;
END;
$$;

REVOKE ALL ON FUNCTION activate_vip_wallet_atomic(UUID, TEXT, TEXT, NUMERIC, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION activate_vip_wallet_atomic(UUID, TEXT, TEXT, NUMERIC, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO service_role;
