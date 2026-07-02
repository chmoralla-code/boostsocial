-- ════════════════════════════════════════════════════════════════
-- FIX: Stop auth.users → profiles CASCADE deletion wiping customer data
-- ════════════════════════════════════════════════════════════════
-- Background:
--   profiles.id REFERENCES auth.users ON DELETE CASCADE.
--   When an auth user is hard-deleted (Supabase unconfirmed-user cleanup,
--   signup re-registration purge, admin delete), Postgres silently
--   cascade-deletes the profiles row, taking email + balance +
--   referral_code + vip_plan with it. The admin Customers directory
--   reads from profiles, so those emails vanish ("satorogoju642@gmail.com"
--   and others).
--
-- Fix:
--   1. Drop the CASCADE FK so a deleted auth user no longer nukes the
--      profile row (which holds the denormalized email/balance used by
--      admin + wallet flows).
--   2. Add a soft-delete marker so we can keep historical profiles even
--      after the auth user is gone, and recover them later.
--   3. Backfill email on any profile row that lost its auth user but
--      still has orders referencing it (recovery for already-lost emails).
-- ════════════════════════════════════════════════════════════════

-- 1. Drop the CASCADE FK entirely. The profile row must outlive the auth
--    user so admin/wallet/audit flows can still read email + balance +
--    referral_code + vip_plan after the auth user is gone.
--    We make profiles.id a plain UUID PRIMARY KEY (no FK to auth.users)
--    so recovery can rebuild profile rows for emails whose auth user was
--    already destroyed (e.g. satorogoju642@gmail.com).
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- profiles.id stays the PK; it's just no longer a FK to auth.users.
-- Existing rows keep their auth-user UUID; new recovered rows use a
-- random UUID (the original auth user is gone and cannot be referenced).

-- 2. Soft-delete marker + timestamp so admins can tell which profiles
--    belong to deleted auth users and recover/restore them later.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_profiles_is_deleted ON profiles(is_deleted);
CREATE INDEX IF NOT EXISTS idx_profiles_email_lower ON profiles(LOWER(email));

-- 3. Recovery backfill: if a profile row still exists but its email is
--    NULL/empty (edge case from partial cascade), restore from orders.
--    This is a no-op if profiles.email is already populated.
UPDATE profiles p
SET email = sub.email
FROM (
  SELECT DISTINCT ON (LOWER(TRIM(customer_email)))
         TRIM(customer_email) AS email,
         LOWER(TRIM(customer_email)) AS email_key
  FROM orders
  WHERE customer_email IS NOT NULL
    AND TRIM(customer_email) <> ''
    AND LOWER(TRIM(customer_email)) <> '[deleted user]'
  ORDER BY LOWER(TRIM(customer_email)), created_at DESC
) sub
WHERE p.email IS NULL OR TRIM(p.email) = '';

-- 4. The other auth.users FKs (topups, vip_subscriptions, referral_transactions,
--    messages, push_subscriptions) ALSO cascade-deleted rows when an auth
--    user was purged — silently destroying topup history, VIP subscriptions,
--    referral transactions, and chat messages. Drop the CASCADE so these
--    rows survive a deleted auth user too. (Recovery can re-link them by
--    email/user_id later if the user re-registers.)
ALTER TABLE topups DROP CONSTRAINT IF EXISTS topups_user_id_fkey;

ALTER TABLE vip_subscriptions DROP CONSTRAINT IF EXISTS vip_subscriptions_user_id_fkey;

ALTER TABLE referral_transactions DROP CONSTRAINT IF EXISTS referral_transactions_referrer_id_fkey;

ALTER TABLE referral_transactions DROP CONSTRAINT IF EXISTS referral_transactions_referee_id_fkey;

ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_user_id_fkey;

ALTER TABLE push_subscriptions DROP CONSTRAINT IF EXISTS push_subscriptions_user_id_fkey;