import postgres from 'postgres';

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DB_URL;

if (!databaseUrl) {
  throw new Error('Missing DATABASE_URL, POSTGRES_URL, or SUPABASE_DB_URL environment variable.');
}

const sql = postgres(databaseUrl, { ssl: 'require' });

async function init() {
  try {
    console.log('Creating services table...');
    await sql`
      CREATE TABLE IF NOT EXISTS services (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        starting_price NUMERIC NOT NULL,
        icon_type TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    console.log('Creating orders table...');
    await sql`
      CREATE TABLE IF NOT EXISTS orders (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        service_id UUID REFERENCES services(id),
        customer_email TEXT NOT NULL,
        target_url TEXT NOT NULL,
        status TEXT DEFAULT 'Pending',
        amount NUMERIC NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    console.log('Creating profiles table...');
    await sql`
      CREATE TABLE IF NOT EXISTS profiles (
        id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
        role TEXT DEFAULT 'customer',
        full_name TEXT,
        email TEXT,
        balance NUMERIC(10, 2) DEFAULT 0.00,
        vip_plan TEXT,
        vip_started_at TIMESTAMPTZ,
        vip_expires_at TIMESTAMPTZ
      );
    `;

    console.log('Creating vip_subscriptions table...');
    await sql`
      CREATE TABLE IF NOT EXISTS vip_subscriptions (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
        email TEXT NOT NULL,
        plan_code TEXT NOT NULL,
        payment_method TEXT NOT NULL DEFAULT 'GCash',
        amount NUMERIC(10, 2) NOT NULL,
        receipt_url TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        notes TEXT,
        reviewed_at TIMESTAMPTZ,
        reviewed_by TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    await sql`
      ALTER TABLE vip_subscriptions ENABLE ROW LEVEL SECURITY;
    `;

    await sql`
      GRANT SELECT ON vip_subscriptions TO authenticated;
    `;

    await sql`
      DROP POLICY IF EXISTS "Users can view own VIP subscriptions" ON vip_subscriptions;
      CREATE POLICY "Users can view own VIP subscriptions"
        ON vip_subscriptions
        FOR SELECT
        TO authenticated
        USING (auth.uid() = user_id);
    `;

    await sql`
      DROP POLICY IF EXISTS "Admins can view VIP subscriptions" ON vip_subscriptions;
      CREATE POLICY "Admins can view VIP subscriptions"
        ON vip_subscriptions
        FOR SELECT
        TO authenticated
        USING (lower(auth.jwt() ->> 'email') LIKE '%@boostsocial.com');
    `;

    await sql`
      CREATE OR REPLACE FUNCTION public.touch_vip_subscriptions_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `;

    await sql`
      DROP TRIGGER IF EXISTS touch_vip_subscriptions_updated_at ON vip_subscriptions;
      CREATE TRIGGER touch_vip_subscriptions_updated_at
        BEFORE UPDATE ON vip_subscriptions
        FOR EACH ROW
        EXECUTE FUNCTION touch_vip_subscriptions_updated_at();
    `;

    console.log('Ensuring orders supports VIP discount fields...');
    await sql`
      ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS original_amount NUMERIC(10, 2),
      ADD COLUMN IF NOT EXISTS vip_plan TEXT,
      ADD COLUMN IF NOT EXISTS vip_discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS vip_discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0;
    `;

    console.log('Seeding services data...');
    await sql`
      INSERT INTO services (title, description, starting_price, icon_type)
      SELECT 'Facebook Followers', 'Genuine, active followers to enhance profile credibility.', 9.99, 'followers'
      WHERE NOT EXISTS (SELECT 1 FROM services WHERE title = 'Facebook Followers');
    `;
    await sql`
      INSERT INTO services (title, description, starting_price, icon_type)
      SELECT 'Post Reactions', 'Instant real likes, hearts, and diverse reactions for your posts.', 4.99, 'reactions'
      WHERE NOT EXISTS (SELECT 1 FROM services WHERE title = 'Post Reactions');
    `;
    await sql`
      INSERT INTO services (title, description, starting_price, icon_type)
      SELECT 'Video Views', 'Boost views for your videos, stories, and Reels instantly.', 12.99, 'views'
      WHERE NOT EXISTS (SELECT 1 FROM services WHERE title = 'Video Views');
    `;
    await sql`
      INSERT INTO services (title, description, starting_price, icon_type)
      SELECT 'AUTONOMOUS BOT', 'Upload product photos, attach captions, and preview a human-approved content queue before publishing.', 499, 'automation'
      WHERE NOT EXISTS (SELECT 1 FROM services WHERE title = 'AUTONOMOUS BOT');
    `;

    console.log('Database initialization completed successfully.');
  } catch (error) {
    console.error('Error initializing database:', error);
  } finally {
    await sql.end();
  }
}

init();
