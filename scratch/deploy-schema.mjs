import postgres from 'postgres';
import fs from 'fs';
import path from 'path';

const connectionString = 'postgresql://postgres.bhunvginzhgnwjkprnxc:Baholobot12345@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres';
const sql = postgres(connectionString, { ssl: 'require' });

async function deploySchema() {
  try {
    console.log('🔗 Connecting to Supabase database...');

    // 1. Create Core Services Table
    console.log('📦 Ensuring core tables exist...');
    await sql`
      CREATE TABLE IF NOT EXISTS public.services (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        starting_price NUMERIC NOT NULL,
        icon_type TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    // 2. Create Core Orders Table
    await sql`
      CREATE TABLE IF NOT EXISTS public.orders (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        service_id UUID REFERENCES public.services(id),
        customer_email TEXT NOT NULL,
        target_url TEXT NOT NULL,
        status TEXT DEFAULT 'Pending',
        amount NUMERIC NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        quantity INTEGER NOT NULL DEFAULT 1000,
        screenshot_url TEXT
      );
    `;

    // 3. Create Settings Table
    console.log('⚙️ Ensuring settings table exists...');
    await sql`
      CREATE TABLE IF NOT EXISTS public.settings (
        key TEXT PRIMARY KEY,
        value JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    // 4. Seed settings if empty
    await sql`
      INSERT INTO public.settings (key, value)
      VALUES ('telegram_config', '{"bot_token": "", "chat_id": ""}'::jsonb)
      ON CONFLICT (key) DO NOTHING;
    `;

    // 5. Run database migrations from the migrations folder
    console.log('🚀 Deploying migrations from "supabase/migrations" directory...');
    const migrationFile = path.join('supabase', 'migrations', '20260518174317_create_profiles_and_topups.sql');
    if (fs.existsSync(migrationFile)) {
      console.log(`Reading migration: ${migrationFile}`);
      const migrationSql = fs.readFileSync(migrationFile, 'utf8');
      
      // Execute the migration SQL
      // Direct execute using postgres.js can run multi-statement raw query
      await sql.unsafe(migrationSql);
      console.log('✅ Migration applied successfully.');
    } else {
      console.warn('⚠️ Migration file not found at local path.');
    }

    // 6. Double check that orders has Realtime enabled
    console.log('⚡ Checking and enabling Realtime on tables...');
    const pubCheck = await sql`
      SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime';
    `;
    if (pubCheck.length === 0) {
      await sql`CREATE PUBLICATION supabase_realtime;`;
    }

    const tableCheck = await sql`
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND tablename = 'orders';
    `;
    if (tableCheck.length === 0) {
      await sql`ALTER PUBLICATION supabase_realtime ADD TABLE orders;`;
      console.log('✅ Realtime enabled on orders table.');
    } else {
      console.log('✅ Realtime is already enabled on orders table.');
    }

    await sql`ALTER TABLE orders REPLICA IDENTITY FULL;`;
    console.log('✅ Replica identity set to FULL on orders table.');

    console.log('🎉 Supabase database deployment synchronized perfectly!');
  } catch (error) {
    console.error('❌ Error during schema deployment:', error);
  } finally {
    await sql.end();
  }
}

deploySchema();
