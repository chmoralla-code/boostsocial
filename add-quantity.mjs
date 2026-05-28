import postgres from 'postgres';

const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DB_URL;

if (!dbUrl) {
  throw new Error('Missing DATABASE_URL, POSTGRES_URL, or SUPABASE_DB_URL environment variable.');
}

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
