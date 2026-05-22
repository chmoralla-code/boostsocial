const postgres = require('postgres');

async function main() {
  const sql = postgres('postgresql://postgres.bhunvginzhgnwjkprnxc:Baholobot12345@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres', { ssl: 'require' });

  try {
    console.log('Adding external_order_id and external_status columns to orders table...');
    await sql`
      ALTER TABLE orders 
      ADD COLUMN IF NOT EXISTS external_order_id TEXT,
      ADD COLUMN IF NOT EXISTS external_status TEXT;
    `;
    console.log('Columns added successfully.');
  } catch (err) {
    console.error('Error adding columns:', err);
  } finally {
    await sql.end();
  }
}
main();
