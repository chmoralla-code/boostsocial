const postgres = require('postgres');

async function main() {
  const sql = postgres('postgresql://postgres.bhunvginzhgnwjkprnxc:Baholobot12345@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres', { ssl: 'require' });

  try {
    const services = await sql`
      SELECT id, title, description, starting_price, icon_type FROM services;
    `;
    console.log(JSON.stringify(services, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await sql.end();
  }
}
main();
