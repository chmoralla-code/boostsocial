import postgres from 'postgres';

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DB_URL;

if (!databaseUrl) {
  throw new Error('Missing DATABASE_URL, POSTGRES_URL, or SUPABASE_DB_URL environment variable.');
}

const sql = postgres(databaseUrl, { ssl: 'require' });

async function createMessagesTable() {
  try {
    console.log('Creating customer_messages table...');
    await sql`
      CREATE TABLE IF NOT EXISTS customer_messages (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        customer_email TEXT NOT NULL,
        sender TEXT NOT NULL CHECK (sender IN ('admin', 'customer', 'system')),
        message TEXT NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    console.log('Creating index on customer_email for fast queries...');
    await sql`
      CREATE INDEX IF NOT EXISTS idx_customer_messages_email ON customer_messages(customer_email);
    `;

    console.log('Creating unread lookup index...');
    await sql`
      CREATE INDEX IF NOT EXISTS idx_customer_messages_unread
      ON customer_messages(customer_email, sender, is_read);
    `;

    console.log('✅ customer_messages table created successfully.');
  } catch (error) {
    console.error('Error creating customer_messages table:', error);
  } finally {
    await sql.end();
  }
}

createMessagesTable();
