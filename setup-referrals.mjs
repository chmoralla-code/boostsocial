import postgres from 'postgres';

const sql = postgres('postgresql://postgres.bhunvginzhgnwjkprnxc:Baholobot12345@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres', { ssl: 'require' });

async function run() {
  try {
    console.log('Altering profiles table to add referral columns...');
    await sql`
      ALTER TABLE public.profiles 
      ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
      ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES public.profiles(id);
    `;

    console.log('Backfilling unique referral codes for existing profiles...');
    await sql`
      UPDATE public.profiles 
      SET referral_code = 'REF-' || UPPER(SUBSTRING(id::text, 1, 8)) 
      WHERE referral_code IS NULL;
    `;

    console.log('Creating referral_transactions table...');
    await sql`
      CREATE TABLE IF NOT EXISTS public.referral_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        referrer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        referee_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        amount NUMERIC(10, 2) NOT NULL,
        description TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    console.log('Successfully completed referral system schema setup!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await sql.end();
  }
}

run();
