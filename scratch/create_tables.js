const { Client } = require('pg');

async function runMigration() {
  const connectionString = `postgresql://postgres.bhunvginzhgnwjkprnxc:Baholobot12345@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`;
  
  const client = new Client({
    connectionString,
  });

  try {
    await client.connect();
    console.log("Connected to Supabase PostgreSQL");

    // 1. Create profiles table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.profiles (
        id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        balance NUMERIC(10, 2) DEFAULT 0.00,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log("Created profiles table.");

    // 2. Create topups table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.topups (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        amount NUMERIC(10, 2) NOT NULL,
        receipt_url TEXT,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log("Created topups table.");

    // 3. Create RLS policies for profiles (optional but good practice)
    // We'll just disable RLS or allow public read/write for now since it's a prototype, 
    // but better to keep it open for service role or authenticated users.
    // Actually, since they are using Next.js server components with Service Role, RLS doesn't block Admin API.
    
    // We can also create an auto-insert trigger for new users into profiles
    await client.query(`
      CREATE OR REPLACE FUNCTION public.handle_new_user()
      RETURNS trigger AS $$
      BEGIN
        INSERT INTO public.profiles (id, email, balance)
        VALUES (new.id, new.email, 0.00);
        RETURN new;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `);
    
    // Drop the trigger if it exists to avoid errors
    await client.query(`DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;`);
    
    await client.query(`
      CREATE TRIGGER on_auth_user_created
        AFTER INSERT ON auth.users
        FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
    `);
    console.log("Created auth.users trigger for profiles.");

    // 4. Backfill existing users into profiles
    await client.query(`
      INSERT INTO public.profiles (id, email, balance)
      SELECT id, email, 0.00 FROM auth.users
      ON CONFLICT (id) DO NOTHING;
    `);
    console.log("Backfilled existing users into profiles.");

  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.end();
  }
}

runMigration();
