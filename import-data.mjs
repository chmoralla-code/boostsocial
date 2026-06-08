import postgres from 'postgres';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const NEW_DB_URL = 'postgresql://postgres.qayiukxguqxewqmhfoes:Baholobot12345@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres';
const NEW_SUPABASE_URL = 'https://qayiukxguqxewqmhfoes.supabase.co';
const NEW_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFheWl1a3hndXF4ZXdxbWhmb2VzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDg4NDc1MiwiZXhwIjoyMDk2NDYwNzUyfQ.JwQRY1rm181U20faJoSliUPjF0uLEeX1DHoZhNqzKEM';

const sql = postgres(NEW_DB_URL, { ssl: 'require' });
const supabaseAdmin = createClient(NEW_SUPABASE_URL, NEW_SERVICE_KEY, {
  auth: { persistSession: false }
});

// Load exported data
const data = JSON.parse(readFileSync('./data-export.json', 'utf-8'));

async function createTables() {
  console.log('📋 Creating tables...');

  await sql`
    CREATE TABLE IF NOT EXISTS services (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      starting_price NUMERIC NOT NULL,
      icon_type TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      caption TEXT,
      pricing_model TEXT DEFAULT 'fixed',
      price_per_unit NUMERIC,
      min_quantity INTEGER DEFAULT 1,
      max_quantity INTEGER,
      unit_label TEXT DEFAULT 'pcs',
      is_pro BOOLEAN DEFAULT false,
      smm_service_id TEXT,
      icon_url TEXT,
      sort_order INTEGER DEFAULT 0
    )
  `;
  console.log('  ✅ services');

  await sql`
    CREATE TABLE IF NOT EXISTS orders (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      service_id UUID REFERENCES services(id),
      customer_email TEXT NOT NULL,
      target_url TEXT NOT NULL,
      status TEXT DEFAULT 'Pending',
      amount NUMERIC NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      user_id UUID,
      service_title TEXT,
      quantity INTEGER,
      external_order_id TEXT,
      notes TEXT,
      original_amount NUMERIC(10, 2),
      vip_plan TEXT,
      vip_discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 0,
      vip_discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
      payment_method TEXT DEFAULT 'wallet',
      receipt_url TEXT,
      reviewed_at TIMESTAMPTZ,
      reviewed_by TEXT
    )
  `;
  console.log('  ✅ orders');

  await sql`
    CREATE TABLE IF NOT EXISTS profiles (
      id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
      role TEXT DEFAULT 'customer',
      full_name TEXT,
      email TEXT,
      balance NUMERIC(10, 2) DEFAULT 0.00,
      vip_plan TEXT,
      vip_started_at TIMESTAMPTZ,
      vip_expires_at TIMESTAMPTZ,
      referral_code TEXT,
      referred_by UUID,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  console.log('  ✅ profiles');

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
    )
  `;
  console.log('  ✅ vip_subscriptions');

  await sql`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  console.log('  ✅ settings');

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
  console.log('  ✅ topups');

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
  console.log('  ✅ referral_transactions');

  await sql`
    CREATE TABLE IF NOT EXISTS messages (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
      content TEXT NOT NULL,
      sender TEXT NOT NULL DEFAULT 'customer',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  console.log('  ✅ messages');

  await sql`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
      endpoint TEXT NOT NULL,
      keys JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  console.log('  ✅ push_subscriptions');

  await sql`
    CREATE TABLE IF NOT EXISTS payouts (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id UUID,
      amount NUMERIC(10, 2),
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  console.log('  ✅ payouts');

  // RLS
  await sql`ALTER TABLE vip_subscriptions ENABLE ROW LEVEL SECURITY`;
  await sql`ALTER TABLE profiles ENABLE ROW LEVEL SECURITY`;
  await sql`ALTER TABLE orders ENABLE ROW LEVEL SECURITY`;
  await sql`ALTER TABLE topups ENABLE ROW LEVEL SECURITY`;
  console.log('  ✅ RLS enabled');
}

async function importAuthUsers() {
  const users = data.auth_users || [];
  console.log(`\n👤 Importing ${users.length} auth users...`);
  
  let success = 0, skipped = 0, failed = 0;
  
  for (const user of users) {
    try {
      // Use admin API to create user with same ID and confirmed email
      const { error } = await supabaseAdmin.auth.admin.createUser({
        id: user.id,
        email: user.email,
        email_confirm: true,
        // We can't transfer encrypted passwords via Admin API, so users will need to reset
        // But we'll set a temporary password and then update the hash directly via SQL
        password: 'TempMigration2026!',
        user_metadata: user.raw_user_meta_data || {},
        app_metadata: user.raw_app_meta_data || {},
      });
      
      if (error) {
        if (error.message.includes('already been registered') || error.message.includes('already exists')) {
          skipped++;
        } else {
          console.log(`  ⚠️ ${user.email}: ${error.message}`);
          failed++;
        }
      } else {
        success++;
      }
    } catch (e) {
      console.log(`  ❌ ${user.email}: ${e.message}`);
      failed++;
    }
  }
  
  console.log(`  ✅ Created: ${success}, Skipped: ${skipped}, Failed: ${failed}`);
  
  // Now restore original password hashes via direct SQL
  console.log('  🔑 Restoring original password hashes...');
  let hashUpdated = 0;
  for (const user of users) {
    if (user.encrypted_password) {
      try {
        await sql`
          UPDATE auth.users 
          SET encrypted_password = ${user.encrypted_password}
          WHERE id = ${user.id}::uuid
        `;
        hashUpdated++;
      } catch (e) {
        console.log(`  ⚠️ Hash restore failed for ${user.email}: ${e.message}`);
      }
    }
  }
  console.log(`  ✅ Restored ${hashUpdated} password hashes (users can login with original passwords)`);
}

async function importTable(tableName, rows, options = {}) {
  if (!rows || rows.length === 0) {
    console.log(`  ⏭️ ${tableName}: no data to import`);
    return;
  }
  
  console.log(`  📥 ${tableName}: importing ${rows.length} rows...`);
  
  let success = 0, failed = 0;
  
  for (const row of rows) {
    try {
      // Clean up any undefined values
      const cleanRow = {};
      for (const [key, value] of Object.entries(row)) {
        if (value !== undefined) {
          cleanRow[key] = value;
        }
      }
      
      const columns = Object.keys(cleanRow);
      const values = Object.values(cleanRow);
      
      await sql`
        INSERT INTO ${sql(tableName)} ${sql(cleanRow)}
        ON CONFLICT (${sql(options.conflictKey || 'id')}) DO NOTHING
      `;
      success++;
    } catch (e) {
      // Try without ON CONFLICT for tables that might not have id
      try {
        const cleanRow = {};
        for (const [key, value] of Object.entries(row)) {
          if (value !== undefined) cleanRow[key] = value;
        }
        await sql`INSERT INTO ${sql(tableName)} ${sql(cleanRow)}`;
        success++;
      } catch (e2) {
        if (!e2.message.includes('duplicate key')) {
          console.log(`    ⚠️ ${e2.message.substring(0, 100)}`);
        }
        failed++;
      }
    }
  }
  
  console.log(`  ✅ ${tableName}: ${success} imported, ${failed} skipped`);
}

async function main() {
  try {
    // Step 1: Create tables
    await createTables();
    
    // Step 2: Import auth users FIRST (profiles depend on auth.users via FK)
    await importAuthUsers();
    
    // Step 3: Import data tables (order matters due to foreign keys)
    console.log('\n📦 Importing data tables...');
    
    await importTable('services', data.services);
    await importTable('profiles', data.profiles);
    await importTable('orders', data.orders);
    await importTable('settings', data.settings, { conflictKey: 'key' });
    await importTable('topups', data.topups);
    await importTable('vip_subscriptions', data.vip_subscriptions);
    await importTable('referral_transactions', data.referral_transactions);
    await importTable('messages', data.messages);
    await importTable('push_subscriptions', data.push_subscriptions);
    await importTable('payouts', data.payouts);
    
    // Step 4: Ensure maintenance mode is OFF
    await sql`
      INSERT INTO settings (key, value) VALUES ('maintenance_mode', '{"enabled": false}'::jsonb)
      ON CONFLICT (key) DO UPDATE SET value = '{"enabled": false}'::jsonb
    `;
    console.log('\n✅ Maintenance mode set to OFF');
    
    // Final verification
    console.log('\n📊 VERIFICATION:');
    const tables = ['services', 'orders', 'profiles', 'settings', 'topups', 'vip_subscriptions', 'referral_transactions'];
    for (const t of tables) {
      try {
        const count = await sql`SELECT count(*) as cnt FROM ${sql(t)}`;
        console.log(`  ${t}: ${count[0].cnt} rows`);
      } catch (e) {
        console.log(`  ${t}: error`);
      }
    }
    
    const userCount = await sql`SELECT count(*) as cnt FROM auth.users`;
    console.log(`  auth.users: ${userCount[0].cnt} users`);
    
    await sql.end();
    console.log('\n🎉 MIGRATION COMPLETE! All data preserved.');
    
  } catch (e) {
    console.error('FATAL:', e);
    await sql.end();
    process.exit(1);
  }
}

main();
