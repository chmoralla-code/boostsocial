# Maintenance Scripts

Operational one-off scripts for the PinoyBoosting platform. These are ops tools —
they talk directly to the databases and should be run with care.

## Running migrations

```bash
node scripts/run-migration.mjs supabase/migrations/20260806000000_feature_suite.sql
```

Applies the SQL to the DigitalOcean primary and every configured Supabase backup
(primary + `BACKUP`/`BACKUP3`/`BACKUP4`/`BACKUP5`). Migration files are idempotent
(`IF NOT EXISTS`), so re-runs are safe.

Env comes from `.env.local` or `process.env`. For Supabase projects you can either:
- set `BACKUP*_DATABASE_URL` (Postgres pooler URL) per label, or
- apply the file manually via the Supabase SQL editor.

## Naming convention

- `backfill-*.mjs` — data backfills / migrations of existing rows.
- `create-*.mjs` — schema or record creation helpers.
- `setup-*.mjs` — environment / settings setup.
- `update-*.mjs|js` — bulk updates of services, prices, captions.
- `import-*.mjs` / `export-*.mjs` — data portability.
- `run-*.mjs` — infra helpers (e.g. run-migration).

## Env

All scripts read `.env.local` at the repo root (never commit it). Sensitive
values are read server-side only — never log keys or credentials.
