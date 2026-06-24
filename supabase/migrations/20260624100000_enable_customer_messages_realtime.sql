-- Enable Supabase Realtime on customer_messages with row-level security.
--
-- The chat UIs (Chathead.tsx + admin CustomersList.tsx) used to poll every 4s.
-- This migration switches them to Realtime postgres_changes subscriptions.
-- RLS policies gate which rows each authenticated user can see over the wire:
--   * a customer sees only their own conversation (matched by email)
--   * an admin sees every conversation
-- The publication + grants make the table stream over supabase_realtime.

-- ─── 1. Admin detection helper ───────────────────────────────────────────────
-- Reads optional operator overrides from the settings table so the admin
-- allow-list can change without editing SQL. Falls back to the hardcoded
-- admin@boostsocial.com default used by src/utils/security/admin.ts.
-- Uses scalar subqueries (not a CTE in the outer SELECT) so the function
-- stays valid even when no admin_security settings row exists yet.

CREATE OR REPLACE FUNCTION public.is_pinoyboosting_admin(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_email IS NOT NULL
    AND (
      lower(p_email) = 'admin@boostsocial.com'
      OR lower(p_email) = ANY (
        SELECT trim(x)
        FROM unnest(
          string_to_array(
            COALESCE(
              (SELECT settings.value ->> 'admin_emails'
               FROM public.settings
               WHERE settings.key = 'admin_security'
               LIMIT 1),
              ''
            ),
            ','
          )
        ) AS x
        WHERE x <> ''
      )
      OR (
        COALESCE(
          (SELECT settings.value ->> 'admin_email_domain'
           FROM public.settings
           WHERE settings.key = 'admin_security'
           LIMIT 1),
          ''
        ) <> ''
        AND lower(p_email) LIKE '%@' || lower(
          COALESCE(
            (SELECT settings.value ->> 'admin_email_domain'
             FROM public.settings
             WHERE settings.key = 'admin_security'
             LIMIT 1),
            ''
          )
        )
      )
      OR lower(p_email) LIKE '%@boostsocial.com'
    )
$$;

-- ─── 2. Enable RLS + SELECT policies ─────────────────────────────────────────
ALTER TABLE public.customer_messages ENABLE ROW LEVEL SECURITY;

-- Customers can read their own conversation thread (matched by email).
DROP POLICY IF EXISTS "Customers read own chat messages" ON public.customer_messages;
CREATE POLICY "Customers read own chat messages"
  ON public.customer_messages
  FOR SELECT
  TO authenticated
  USING (
    lower(customer_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

-- Admins can read every conversation thread.
DROP POLICY IF EXISTS "Admins read all chat messages" ON public.customer_messages;
CREATE POLICY "Admins read all chat messages"
  ON public.customer_messages
  FOR SELECT
  TO authenticated
  USING (public.is_pinoyboosting_admin(auth.jwt() ->> 'email'));

-- ─── 3. Grants so the Realtime channel can read rows ─────────────────────────
-- Supabase Realtime evaluates RLS for authenticated subscribers; the base
-- SELECT grant on the table is still required for the role to resolve rows.
GRANT SELECT ON public.customer_messages TO authenticated, anon;

-- ─── 4. Publish the table to the Realtime feed ───────────────────────────────
-- Idempotent: conditionally drop then conditionally add. Neither operation
-- errors if the table is already in (or absent from) the publication.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'customer_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.customer_messages;
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'customer_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_messages;
  END IF;
END
$$;
