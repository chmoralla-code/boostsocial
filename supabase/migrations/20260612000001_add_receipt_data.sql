ALTER TABLE topups ADD COLUMN IF NOT EXISTS receipt_data TEXT;
ALTER TABLE topups ADD COLUMN IF NOT EXISTS receipt_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_topups_receipt_hash ON topups(receipt_hash);
