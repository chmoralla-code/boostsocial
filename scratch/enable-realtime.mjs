import postgres from 'postgres';

const connectionString = 'postgresql://postgres.bhunvginzhgnwjkprnxc:Baholobot12345@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres';
const sql = postgres(connectionString, { ssl: 'require' });

async function enableRealtime() {
  try {
    console.log('Checking publication "supabase_realtime"...');
    
    // Check if the publication exists
    const pubCheck = await sql`
      SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime';
    `;
    
    if (pubCheck.length === 0) {
      console.log('Creating publication "supabase_realtime"...');
      await sql`
        CREATE PUBLICATION supabase_realtime;
      `;
    }
    
    // Check if the orders table is already in the publication
    const tableCheck = await sql`
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND tablename = 'orders';
    `;
    
    if (tableCheck.length === 0) {
      console.log('Adding "orders" table to "supabase_realtime" publication...');
      await sql`
        ALTER PUBLICATION supabase_realtime ADD TABLE orders;
      `;
      console.log('Successfully enabled Realtime replication for "orders" table.');
    } else {
      console.log('Realtime replication for "orders" table is already enabled.');
    }

    // Set REPLICA IDENTITY to FULL so we receive complete row updates in real-time payloads
    console.log('Setting REPLICA IDENTITY to FULL for "orders" table...');
    await sql`
      ALTER TABLE orders REPLICA IDENTITY FULL;
    `;
    console.log('Successfully set REPLICA IDENTITY to FULL for "orders" table.');

  } catch (error) {
    console.error('Error enabling Realtime replication:', error);
  } finally {
    await sql.end();
  }
}

enableRealtime();
