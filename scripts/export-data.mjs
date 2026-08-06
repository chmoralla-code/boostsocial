import postgres from 'postgres';
import { writeFileSync } from 'fs';

// Connect to the backup database (which has the most recent data from dual-writes)
const BACKUP_URL = process.env.BACKUP_DATABASE_URL;
const PRIMARY_URL = process.env.DATABASE_URL;
if (!BACKUP_URL || !PRIMARY_URL) {
  console.error('Missing required env vars: BACKUP_DATABASE_URL and DATABASE_URL');
  process.exit(1);
}

async function exportFromDb(url, label) {
  const sql = postgres(url, { ssl: 'require' });
  const data = {};

  const tables = [
    'profiles',
    'services', 
    'orders',
    'settings',
    'topups',
    'vip_subscriptions',
    'referral_transactions',
    'messages',
    'push_subscriptions',
    'payouts',
  ];

  for (const table of tables) {
    try {
      const rows = await sql`SELECT * FROM ${sql(table)}`;
      data[table] = rows;
      console.log(`  ${label} → ${table}: ${rows.length} rows`);
    } catch (e) {
      console.log(`  ${label} → ${table}: SKIP (${e.message.substring(0, 80)})`);
      data[table] = [];
    }
  }

  // Export auth users via auth.users table (direct postgres access)
  try {
    const users = await sql`
      SELECT id, email, encrypted_password, email_confirmed_at, 
             created_at, updated_at, raw_user_meta_data, raw_app_meta_data,
             role, aud, confirmation_token, recovery_token
      FROM auth.users
    `;
    data['auth_users'] = users;
    console.log(`  ${label} → auth.users: ${users.length} users`);
  } catch (e) {
    console.log(`  ${label} → auth.users: SKIP (${e.message.substring(0, 80)})`);
    data['auth_users'] = [];
  }

  await sql.end();
  return data;
}

async function main() {
  console.log('📦 Exporting from BACKUP database...');
  const backupData = await exportFromDb(BACKUP_URL, 'BACKUP');
  
  console.log('\n📦 Exporting from PRIMARY database...');
  const primaryData = await exportFromDb(PRIMARY_URL, 'PRIMARY');

  // Merge strategy: prefer backup data if it has more rows, otherwise use primary
  const merged = {};
  const allTables = new Set([...Object.keys(backupData), ...Object.keys(primaryData)]);
  
  for (const table of allTables) {
    const backupRows = backupData[table] || [];
    const primaryRows = primaryData[table] || [];
    
    if (table === 'auth_users') {
      // Merge auth users by ID (union of both)
      const userMap = new Map();
      for (const u of primaryRows) userMap.set(u.id, u);
      for (const u of backupRows) userMap.set(u.id, u); // backup overwrites if exists
      merged[table] = Array.from(userMap.values());
      console.log(`\n🔀 ${table}: PRIMARY=${primaryRows.length}, BACKUP=${backupRows.length}, MERGED=${merged[table].length}`);
    } else if (table === 'settings') {
      // Merge settings by key
      const settingsMap = new Map();
      for (const s of primaryRows) settingsMap.set(s.key, s);
      for (const s of backupRows) settingsMap.set(s.key, s);
      merged[table] = Array.from(settingsMap.values());
      console.log(`🔀 ${table}: PRIMARY=${primaryRows.length}, BACKUP=${backupRows.length}, MERGED=${merged[table].length}`);
    } else {
      // Merge by ID (union)
      const idMap = new Map();
      for (const row of primaryRows) { if (row.id) idMap.set(row.id, row); }
      for (const row of backupRows) { if (row.id) idMap.set(row.id, row); }
      merged[table] = idMap.size > 0 ? Array.from(idMap.values()) : (backupRows.length >= primaryRows.length ? backupRows : primaryRows);
      console.log(`🔀 ${table}: PRIMARY=${primaryRows.length}, BACKUP=${backupRows.length}, MERGED=${merged[table].length}`);
    }
  }

  const outputPath = './data-export.json';
  writeFileSync(outputPath, JSON.stringify(merged, null, 2));
  console.log(`\n✅ All data exported to ${outputPath}`);
  
  // Summary
  console.log('\n📊 EXPORT SUMMARY:');
  for (const [table, rows] of Object.entries(merged)) {
    console.log(`  ${table}: ${rows.length} rows`);
  }
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
