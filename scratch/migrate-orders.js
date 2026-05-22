const { createClient } = require('@supabase/supabase-js');
const postgres = require('postgres');

const sql = postgres('postgresql://postgres.bhunvginzhgnwjkprnxc:Baholobot12345@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres', { ssl: 'require' });

async function migrate() {
  try {
    console.log('Adding smm_service_id to orders table...');
    await sql`
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS smm_service_id TEXT;
    `;
    console.log('Successfully added smm_service_id column to orders table!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await sql.end();
  }
}

migrate();
