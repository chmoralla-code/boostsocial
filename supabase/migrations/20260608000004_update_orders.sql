ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS external_status TEXT,
  ADD COLUMN IF NOT EXISTS smm_service_id TEXT;
