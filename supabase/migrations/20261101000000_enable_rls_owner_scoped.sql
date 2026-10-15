-- Owner-scoped Row Level Security for customer data.
--
-- WHY: `orders`, `topups`, `profiles`, `vip_subscriptions`, `settings` and
-- `services` had RLS DISABLED on both databases. The public browser key could
-- therefore read every row - including the plaintext portal credentials that
-- some services store in `orders.target_url`, every customer's email and
-- wallet balance, and the Telegram bot tokens in `settings`.
--
-- This migration is written to run safely on BOTH databases:
--   * DigitalOcean master  - plain Postgres, no `auth` schema, no anon role.
--     RLS is enabled (defence in depth); policies are skipped because the
--     app only ever reaches it server-side as `doadmin`, which bypasses RLS.
--   * Supabase project      - has auth.uid()/auth.jwt(), anon + authenticated
--     roles. RLS is enabled AND owner-scoped policies are created.
--
-- Every statement is guarded, so running it twice is safe.

-- ---------------------------------------------------------------------------
-- 1. Turn RLS on everywhere it was off (idempotent, works on both databases)
-- ---------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.orders                ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.topups                ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.vip_subscriptions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.settings              ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.services              ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.messages              ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.referral_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.push_subscriptions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.daily_checkins        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.order_events          ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.refill_orders         ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 2. Policies - only where the Supabase auth schema exists
-- ---------------------------------------------------------------------------
DO $rls$
DECLARE
  -- The admin check mirrors src/utils/security/admin.ts: a configured
  -- ADMIN_EMAILS list (default admin@boostsocial.com) plus an optional
  -- ADMIN_EMAIL_DOMAIN. Neither env var is set in production today, so the
  -- default address and the boostsocial.com domain are what we match on.
  admin_expr CONSTANT text :=
    $q$(
      lower(coalesce(auth.jwt() ->> 'email', '')) = 'admin@boostsocial.com'
      OR lower(coalesce(auth.jwt() ->> 'email', '')) LIKE '%@boostsocial.com'
    )$q$;
BEGIN
  IF to_regprocedure('auth.uid()') IS NULL THEN
    RAISE NOTICE 'auth.uid() not available - RLS enabled but no policies created (non-Supabase database).';
    RETURN;
  END IF;

  -- =========================== orders ======================================
  IF to_regclass('public.orders') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Owners read own orders" ON public.orders;
    EXECUTE format($f$
      CREATE POLICY "Owners read own orders" ON public.orders
      FOR SELECT TO authenticated
      USING (
        auth.uid() = user_id
        OR lower(coalesce(customer_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
    $f$);

    DROP POLICY IF EXISTS "Admins read all orders" ON public.orders;
    EXECUTE format($f$
      CREATE POLICY "Admins read all orders" ON public.orders
      FOR SELECT TO authenticated USING %s
    $f$, admin_expr);

    -- No INSERT/UPDATE/DELETE policy is created on purpose: every write goes
    -- through the server with the service-role key, which bypasses RLS.
  END IF;

  -- =========================== topups ======================================
  IF to_regclass('public.topups') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Owners read own topups" ON public.topups;
    EXECUTE format($f$
      CREATE POLICY "Owners read own topups" ON public.topups
      FOR SELECT TO authenticated
      USING (
        auth.uid() = user_id
        OR lower(coalesce(email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
    $f$);

    DROP POLICY IF EXISTS "Admins read all topups" ON public.topups;
    EXECUTE format($f$
      CREATE POLICY "Admins read all topups" ON public.topups
      FOR SELECT TO authenticated USING %s
    $f$, admin_expr);
  END IF;

  -- =========================== profiles ====================================
  IF to_regclass('public.profiles') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Owners read own profile" ON public.profiles;
    EXECUTE format($f$
      CREATE POLICY "Owners read own profile" ON public.profiles
      FOR SELECT TO authenticated USING (auth.uid() = id)
    $f$);

    DROP POLICY IF EXISTS "Admins read all profiles" ON public.profiles;
    EXECUTE format($f$
      CREATE POLICY "Admins read all profiles" ON public.profiles
      FOR SELECT TO authenticated USING %s
    $f$, admin_expr);
  END IF;

  -- ====================== vip_subscriptions ================================
  IF to_regclass('public.vip_subscriptions') IS NOT NULL THEN
    -- Legacy policies from an earlier migration: replaced below by the
    -- canonical pair so the table does not carry two redundant sets.
    DROP POLICY IF EXISTS "Users can view own VIP subscriptions" ON public.vip_subscriptions;
    DROP POLICY IF EXISTS "Admins can view VIP subscriptions" ON public.vip_subscriptions;

    DROP POLICY IF EXISTS "Owners read own vip subscriptions" ON public.vip_subscriptions;
    EXECUTE format($f$
      CREATE POLICY "Owners read own vip subscriptions" ON public.vip_subscriptions
      FOR SELECT TO authenticated
      USING (
        auth.uid() = user_id
        OR lower(coalesce(email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
    $f$);

    DROP POLICY IF EXISTS "Admins read all vip subscriptions" ON public.vip_subscriptions;
    EXECUTE format($f$
      CREATE POLICY "Admins read all vip subscriptions" ON public.vip_subscriptions
      FOR SELECT TO authenticated USING %s
    $f$, admin_expr);
  END IF;

  -- =========================== settings ====================================
  -- The old policy was named "Allow service role" but was granted to PUBLIC,
  -- which is what let the browser key read the Telegram bot tokens.
  IF to_regclass('public.settings') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Allow service role" ON public.settings;

    -- Only non-sensitive keys are readable by the public site. The homepage
    -- reads `services_candidates` and the announcement/hero/widget panels are
    -- served through server routes; the bot tokens and VAPID keys stay hidden.
    DROP POLICY IF EXISTS "Public reads non-sensitive settings" ON public.settings;
    EXECUTE format($f$
      CREATE POLICY "Public reads non-sensitive settings" ON public.settings
      FOR SELECT TO anon, authenticated
      USING (
        key IN (
          'announcement',
          'client_announcement',
          'hero_text',
          'maintenance_mode',
          'mobile_app_settings',
          'services_bg_settings',
          'services_candidates',
          'service_showcase',
          'widget_visibility'
        )
      )
    $f$);

    DROP POLICY IF EXISTS "Admins read all settings" ON public.settings;
    EXECUTE format($f$
      CREATE POLICY "Admins read all settings" ON public.settings
      FOR SELECT TO authenticated USING %s
    $f$, admin_expr);
  END IF;

  -- =========================== services ====================================
  -- The catalog is public by design: the homepage, the live ticker and the
  -- catalog modal all read it with the browser key.
  IF to_regclass('public.services') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Public reads the service catalog" ON public.services;
    EXECUTE format($f$
      CREATE POLICY "Public reads the service catalog" ON public.services
      FOR SELECT TO anon, authenticated USING (true)
    $f$);
  END IF;

  -- =========================== messages ====================================
  IF to_regclass('public.messages') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Owners read own messages" ON public.messages;
    EXECUTE format($f$
      CREATE POLICY "Owners read own messages" ON public.messages
      FOR SELECT TO authenticated USING (auth.uid() = user_id)
    $f$);

    DROP POLICY IF EXISTS "Admins read all messages" ON public.messages;
    EXECUTE format($f$
      CREATE POLICY "Admins read all messages" ON public.messages
      FOR SELECT TO authenticated USING %s
    $f$, admin_expr);
  END IF;

  -- ====================== referral_transactions ============================
  IF to_regclass('public.referral_transactions') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Owners read own referrals" ON public.referral_transactions;
    EXECUTE format($f$
      CREATE POLICY "Owners read own referrals" ON public.referral_transactions
      FOR SELECT TO authenticated
      USING (auth.uid() = referrer_id OR auth.uid() = referee_id)
    $f$);

    DROP POLICY IF EXISTS "Admins read all referrals" ON public.referral_transactions;
    EXECUTE format($f$
      CREATE POLICY "Admins read all referrals" ON public.referral_transactions
      FOR SELECT TO authenticated USING %s
    $f$, admin_expr);
  END IF;

  -- ====================== push_subscriptions ===============================
  -- A correct policy already exists on the Supabase project; recreate it so
  -- the state is identical after this migration.
  IF to_regclass('public.push_subscriptions') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users can manage own push subscriptions" ON public.push_subscriptions;
    EXECUTE format($f$
      CREATE POLICY "Users can manage own push subscriptions" ON public.push_subscriptions
      FOR ALL TO authenticated
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)
    $f$);
  END IF;

  -- ======================== daily_checkins =================================
  IF to_regclass('public.daily_checkins') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Owners read own check-ins" ON public.daily_checkins;
    EXECUTE format($f$
      CREATE POLICY "Owners read own check-ins" ON public.daily_checkins
      FOR SELECT TO authenticated USING (auth.uid() = user_id)
    $f$);

    DROP POLICY IF EXISTS "Admins read all check-ins" ON public.daily_checkins;
    EXECUTE format($f$
      CREATE POLICY "Admins read all check-ins" ON public.daily_checkins
      FOR SELECT TO authenticated USING %s
    $f$, admin_expr);
  END IF;

  -- ========================= order_events ==================================
  -- Timeline rows hang off an order, so ownership is resolved through it.
  -- A SECURITY DEFINER helper keeps the sub-query from re-entering the orders
  -- policy (which would recurse).
  IF to_regclass('public.order_events') IS NOT NULL AND to_regclass('public.orders') IS NOT NULL THEN
    EXECUTE $f$
      CREATE OR REPLACE FUNCTION public.order_belongs_to_caller(p_order_id uuid)
      RETURNS boolean
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = public
      AS $body$
        SELECT EXISTS (
          SELECT 1 FROM public.orders o
          WHERE o.id = p_order_id
            AND (
              o.user_id = auth.uid()
              OR lower(coalesce(o.customer_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
            )
        );
      $body$;
    $f$;

    DROP POLICY IF EXISTS "Owners read own order events" ON public.order_events;
    EXECUTE format($f$
      CREATE POLICY "Owners read own order events" ON public.order_events
      FOR SELECT TO authenticated USING (public.order_belongs_to_caller(order_id))
    $f$);

    DROP POLICY IF EXISTS "Admins read all order events" ON public.order_events;
    EXECUTE format($f$
      CREATE POLICY "Admins read all order events" ON public.order_events
      FOR SELECT TO authenticated USING %s
    $f$, admin_expr);
  END IF;

  -- ========================= refill_orders =================================
  IF to_regclass('public.refill_orders') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Owners read own refills" ON public.refill_orders;
    EXECUTE format($f$
      CREATE POLICY "Owners read own refills" ON public.refill_orders
      FOR SELECT TO authenticated
      USING (lower(coalesce(customer_email, '')) = lower(coalesce(auth.jwt() ->> 'email', '')))
    $f$);

    DROP POLICY IF EXISTS "Admins read all refills" ON public.refill_orders;
    EXECUTE format($f$
      CREATE POLICY "Admins read all refills" ON public.refill_orders
      FOR SELECT TO authenticated USING %s
    $f$, admin_expr);
  END IF;
END
$rls$;

-- ---------------------------------------------------------------------------
-- 3. Sanity: report the resulting state
-- ---------------------------------------------------------------------------
DO $report$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.relname AS tbl, c.relrowsecurity AS on_off,
           (SELECT count(*) FROM pg_policies p
             WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS pols
    FROM pg_class c
    WHERE c.relnamespace = 'public'::regnamespace
      AND c.relname IN ('orders','topups','profiles','vip_subscriptions',
                        'settings','services','messages','referral_transactions',
                        'push_subscriptions','daily_checkins','order_events','refill_orders')
    ORDER BY c.relname
  LOOP
    RAISE NOTICE '% RLS=% policies=%', rpad(r.tbl, 22), CASE WHEN r.on_off THEN 'ON ' ELSE 'OFF' END, r.pols;
  END LOOP;
END
$report$;
