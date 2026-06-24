-- Admin secrets table for storing sensitive server-side values (e.g. the admin PIN hash).
--
-- Security model:
--   - RLS is ENABLED.
--   - NO policies are defined for anon / authenticated roles.
--   - With RLS on and no matching policies, anon + authenticated roles get ZERO access.
--   - The service_role bypasses RLS entirely, so server-side code using the
--     service role key is the only thing that can read or write these rows.
--
-- This is intentionally stricter than the public `settings` table, whose
-- "Service role full access" policy is actually permissive to all roles.
-- A 4-digit PIN hash stored there could be brute-forced offline by anyone
-- with the public anon key, so the PIN lives here instead.

CREATE TABLE IF NOT EXISTS public.admin_secrets (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.admin_secrets ENABLE ROW LEVEL SECURITY;

-- Ensure no permissive policies sneak in (idempotent re-run safety).
-- We deliberately do NOT create any SELECT / INSERT / UPDATE / DELETE policies.
-- Only the service role (which bypasses RLS) can touch this table.
