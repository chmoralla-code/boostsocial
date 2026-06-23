-- Fix: Ensure service_title column exists on orders table
-- This column is referenced by the order creation flow and the
-- create_wallet_order RPC function. Some production databases were
-- missing it, causing "column service_title of relation orders does
-- not exist" errors when placing orders.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS service_title TEXT;
