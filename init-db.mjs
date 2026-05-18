import postgres from 'postgres';

const sql = postgres('postgresql://postgres.bhunvginzhgnwjkprnxc:Baholobot12345@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres', { ssl: 'require' });

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
        full_name TEXT
      );
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

    console.log('Database initialization completed successfully.');
  } catch (error) {
    console.error('Error initializing database:', error);
  } finally {
    await sql.end();
  }
}

init();
