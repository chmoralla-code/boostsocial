-- Add email and balance columns to existing profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS balance NUMERIC(10, 2) DEFAULT 0.00;


-- Create topups table to track GCash top-up requests
CREATE TABLE IF NOT EXISTS public.topups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  receipt_url TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to automatically create a profile record when a new user registers
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, balance)
  VALUES (new.id, new.email, 0.00);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists to ensure idempotency
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the trigger on the auth.users table
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Backfill existing users into the profiles table
INSERT INTO public.profiles (id, email, balance)
SELECT id, email, 0.00 FROM auth.users
ON CONFLICT (id) DO UPDATE SET 
  email = EXCLUDED.email, 
  balance = COALESCE(public.profiles.balance, 0.00);
