-- Store extracted GCash Ref No. for unique duplicate checks across top-ups and orders.
ALTER TABLE topups ADD COLUMN IF NOT EXISTS gcash_reference TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS gcash_reference TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS receipt_data TEXT;

CREATE INDEX IF NOT EXISTS idx_topups_gcash_reference ON topups(gcash_reference);
CREATE INDEX IF NOT EXISTS idx_orders_gcash_reference ON orders(gcash_reference);
