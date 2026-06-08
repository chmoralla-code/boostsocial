-- VIP subscription account system (shared fields + request queue + order discount fields)

-- Ensure profile table has VIP status fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS vip_plan TEXT,
  ADD COLUMN IF NOT EXISTS vip_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS vip_expires_at TIMESTAMPTZ;

-- Ensure new discount fields exist on orders (used by create/checkout paths)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS original_amount NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS vip_plan TEXT,
  ADD COLUMN IF NOT EXISTS vip_discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vip_discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0;

-- Pending/rejected/approved VIP subscription requests (used for GCash requests and manual review)
CREATE TABLE IF NOT EXISTS public.vip_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  plan_code TEXT NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'GCash',
  amount NUMERIC(10, 2) NOT NULL,
  receipt_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.vip_subscriptions ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.vip_subscriptions TO authenticated;

DROP POLICY IF EXISTS "Users can view own VIP subscriptions" ON public.vip_subscriptions;
CREATE POLICY "Users can view own VIP subscriptions"
  ON public.vip_subscriptions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view VIP subscriptions" ON public.vip_subscriptions;
CREATE POLICY "Admins can view VIP subscriptions"
  ON public.vip_subscriptions
  FOR SELECT
  TO authenticated
  USING (lower(auth.jwt() ->> 'email') LIKE '%@boostsocial.com');

-- Keep updated_at in sync for VIP subscriptions
CREATE OR REPLACE FUNCTION public.touch_vip_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS touch_vip_subscriptions_updated_at ON public.vip_subscriptions;
CREATE TRIGGER touch_vip_subscriptions_updated_at
  BEFORE UPDATE ON public.vip_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_vip_subscriptions_updated_at();

-- Backfill existing profiles and ensure VIP fields are always present in schema creation trigger
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, balance, vip_plan, vip_started_at, vip_expires_at)
  VALUES (new.id, new.email, 0.00, NULL, NULL, NULL);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

INSERT INTO public.profiles (id, email, balance, vip_plan, vip_started_at, vip_expires_at)
SELECT id, email, 0.00, NULL, NULL, NULL
FROM auth.users
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  balance = COALESCE(public.profiles.balance, 0.00);
