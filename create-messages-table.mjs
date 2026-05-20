import postgres from 'postgres';

const databaseUrl = 'postgresql://postgres.bhunvginzhgnwjkprnxc:Baholobot12345@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres';
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

    console.log('✅ customer_messages table created successfully.');
  } catch (error) {
    console.error('Error creating customer_messages table:', error);
  } finally {
    await sql.end();
  }
}

createMessagesTable();
