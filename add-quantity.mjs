import postgres from 'postgres';

const dbUrl = 'postgresql://postgres.bhunvginzhgnwjkprnxc:Baholobot12345@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres';
const sql = postgres(dbUrl, { ssl: 'require' });

async function migrate() {
  try {
    console.log('Adding quantity column to orders table...');
    await sql`
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1000;
    `;
    console.log('Migration completed.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await sql.end();
  }
}

migrate();
