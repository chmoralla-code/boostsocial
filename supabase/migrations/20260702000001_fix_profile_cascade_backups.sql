-- Trimmed recovery migration for BACKUP databases (older schema, missing
-- messages/push_subscriptions tables). Applies the same CASCADE fix to the
-- tables that exist on backups.
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_id_fkey;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_profiles_is_deleted ON profiles(is_deleted);
CREATE INDEX IF NOT EXISTS idx_profiles_email_lower ON profiles(LOWER(email));

ALTER TABLE topups DROP CONSTRAINT IF EXISTS topups_user_id_fkey;

ALTER TABLE vip_subscriptions DROP CONSTRAINT IF EXISTS vip_subscriptions_user_id_fkey;

ALTER TABLE referral_transactions DROP CONSTRAINT IF EXISTS referral_transactions_referrer_id_fkey;

ALTER TABLE referral_transactions DROP CONSTRAINT IF EXISTS referral_transactions_referee_id_fkey;

-- messages / push_subscriptions may not exist on older backup schemas; guard.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'messages') THEN
    ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_user_id_fkey;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'push_subscriptions') THEN
    ALTER TABLE push_subscriptions DROP CONSTRAINT IF EXISTS push_subscriptions_user_id_fkey;
  END IF;
END
$$;