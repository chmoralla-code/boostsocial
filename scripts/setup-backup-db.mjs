import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

async function setup() {
  try {
    // RLS on vip_subscriptions
    await sql`ALTER TABLE vip_subscriptions ENABLE ROW LEVEL SECURITY`;
    console.log('✅ RLS enabled on vip_subscriptions');
  } catch (e) {
    console.log('RLS:', e.message);
  }

  try {
    await sql`GRANT SELECT ON vip_subscriptions TO authenticated`;
    console.log('✅ GRANT SELECT done');
  } catch (e) {
    console.log('GRANT:', e.message);
  }

  try {
    // Orders VIP discount columns
    await sql`
      ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS original_amount NUMERIC(10, 2),
      ADD COLUMN IF NOT EXISTS vip_plan TEXT,
      ADD COLUMN IF NOT EXISTS vip_discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS vip_discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0
    `;
    console.log('✅ Orders VIP columns ensured');
  } catch (e) {
    console.log('Orders columns:', e.message);
  }

  try {
    // Check existing services
    const rows = await sql`SELECT count(*) as cnt FROM services`;
    console.log('📊 Services count:', rows[0].cnt);
  } catch (e) {
    console.log('Services count:', e.message);
  }

  try {
    // Seed services
    await sql`
      INSERT INTO services (title, description, starting_price, icon_type)
      SELECT 'Facebook Followers', 'Genuine, active followers to enhance profile credibility.', 9.99, 'followers'
      WHERE NOT EXISTS (SELECT 1 FROM services WHERE title = 'Facebook Followers')
    `;
    await sql`
      INSERT INTO services (title, description, starting_price, icon_type)
      SELECT 'Post Reactions', 'Instant real likes, hearts, and diverse reactions for your posts.', 4.99, 'reactions'
      WHERE NOT EXISTS (SELECT 1 FROM services WHERE title = 'Post Reactions')
    `;
    await sql`
      INSERT INTO services (title, description, starting_price, icon_type)
      SELECT 'Video Views', 'Boost views for your videos, stories, and Reels instantly.', 12.99, 'views'
      WHERE NOT EXISTS (SELECT 1 FROM services WHERE title = 'Video Views')
    `;
    await sql`
      INSERT INTO services (title, description, starting_price, icon_type)
      SELECT 'AUTONOMOUS BOT', 'Upload product photos, attach captions, and preview a human-approved content queue before publishing.', 499, 'automation'
      WHERE NOT EXISTS (SELECT 1 FROM services WHERE title = 'AUTONOMOUS BOT')
    `;
    console.log('✅ Services seeded');
  } catch (e) {
    console.log('Services seed:', e.message);
  }

  // Create settings table
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    console.log('✅ Settings table created');
  } catch (e) {
    console.log('Settings table:', e.message);
  }

  // Create messages table
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS messages (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
        content TEXT NOT NULL,
        sender TEXT NOT NULL DEFAULT 'customer',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    console.log('✅ Messages table created');
  } catch (e) {
    console.log('Messages table:', e.message);
  }

  // Create referral_transactions table
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS referral_transactions (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        referrer_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
        referee_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
        amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
        description TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    console.log('✅ Referral transactions table created');
  } catch (e) {
    console.log('Referral transactions:', e.message);
  }

  // Add referral columns to profiles
  try {
    await sql`
      ALTER TABLE profiles
      ADD COLUMN IF NOT EXISTS referral_code TEXT,
      ADD COLUMN IF NOT EXISTS referred_by UUID
    `;
    console.log('✅ Profiles referral columns ensured');
  } catch (e) {
    console.log('Profiles referral columns:', e.message);
  }

  // Ensure topups table exists
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS topups (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
        email TEXT NOT NULL,
        amount NUMERIC(10, 2) NOT NULL,
        payment_method TEXT NOT NULL DEFAULT 'GCash',
        receipt_url TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        reviewed_at TIMESTAMPTZ,
        reviewed_by TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    console.log('✅ Topups table created');
  } catch (e) {
    console.log('Topups table:', e.message);
  }

  // Ensure push_subscriptions table exists
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
        endpoint TEXT NOT NULL,
        keys JSONB NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    console.log('✅ Push subscriptions table created');
  } catch (e) {
    console.log('Push subscriptions:', e.message);
  }

  // Initialize default settings
  try {
    await sql`
      INSERT INTO settings (key, value) VALUES ('maintenance_mode', '{"enabled": false}'::jsonb)
      ON CONFLICT (key) DO NOTHING
    `;
    await sql`
      INSERT INTO settings (key, value) VALUES ('announcement', '{"enabled": false, "text": ""}'::jsonb)
      ON CONFLICT (key) DO NOTHING
    `;
    console.log('✅ Default settings initialized');
  } catch (e) {
    console.log('Default settings:', e.message);
  }

  // Final verification
  try {
    const tables = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    console.log('\n📋 All public tables:');
    tables.forEach(t => console.log('  •', t.table_name));
  } catch (e) {
    console.log('Table list:', e.message);
  }

  await sql.end();
  console.log('\n🎉 Database setup complete!');
}

setup();
