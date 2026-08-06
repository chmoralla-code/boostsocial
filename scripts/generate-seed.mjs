import { readFileSync, writeFileSync } from 'fs';

const data = JSON.parse(readFileSync('./data-export.json', 'utf-8'));

function escapeSqlString(str) {
  if (str === null || str === undefined) return 'NULL';
  if (typeof str === 'boolean') return str ? 'true' : 'false';
  if (typeof str === 'number') return str.toString();
  if (typeof str === 'object') return `'${JSON.stringify(str).replace(/'/g, "''")}'::jsonb`;
  return `'${str.toString().replace(/'/g, "''")}'`;
}

let sql = '';

// Enable auth insertions
sql += 'SET session_replication_role = replica;\n\n';

// 1. Insert into auth.users first
const users = data.auth_users || [];
if (users.length > 0) {
  sql += '-- AUTH USERS\n';
  sql += 'INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token) VALUES\n';
  const userRows = users.map(u => `('00000000-0000-0000-0000-000000000000', ${escapeSqlString(u.id)}, ${escapeSqlString(u.aud || 'authenticated')}, ${escapeSqlString(u.role || 'authenticated')}, ${escapeSqlString(u.email)}, ${escapeSqlString(u.encrypted_password)}, ${escapeSqlString(u.email_confirmed_at || new Date().toISOString())}, ${escapeSqlString(u.created_at)}, ${escapeSqlString(u.updated_at)}, ${escapeSqlString(u.raw_app_meta_data || {provider: 'email', providers: ['email']})}, ${escapeSqlString(u.raw_user_meta_data || {})}, ${escapeSqlString(u.confirmation_token || '')}, ${escapeSqlString(u.recovery_token || '')})`);
  sql += userRows.join(',\n') + '\nON CONFLICT (id) DO NOTHING;\n\n';
  
  // also add them to auth.identities
  sql += '-- AUTH IDENTITIES\n';
  sql += 'INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at) VALUES\n';
  const identityRows = users.map(u => `(gen_random_uuid(), ${escapeSqlString(u.id)}, ${escapeSqlString(u.id)}, ${escapeSqlString({sub: u.id})}, 'email', ${escapeSqlString(u.updated_at)}, ${escapeSqlString(u.created_at)}, ${escapeSqlString(u.updated_at)})`);
  sql += identityRows.join(',\n') + '\nON CONFLICT (provider_id, provider) DO NOTHING;\n\n';
}

// Helper for generic tables
function addTableSql(tableName, rows) {
  if (!rows || rows.length === 0) return;
  sql += `-- ${tableName.toUpperCase()}\n`;
  const columns = Object.keys(rows[0]);
  
  // Clean rows
  const validRows = rows.map(r => {
    return `(${columns.map(c => escapeSqlString(r[c])).join(', ')})`;
  });

  const conflictKey = tableName === 'settings' ? 'key' : 'id';
  
  sql += `INSERT INTO public.${tableName} (${columns.map(c => `"${c}"`).join(', ')}) VALUES\n`;
  sql += validRows.join(',\n');
  if (columns.includes(conflictKey)) {
    sql += `\nON CONFLICT ("${conflictKey}") DO NOTHING;\n\n`;
  } else {
    sql += `;\n\n`;
  }
}

addTableSql('services', data.services);
addTableSql('profiles', data.profiles);
addTableSql('orders', data.orders);
addTableSql('settings', data.settings);
addTableSql('topups', data.topups);
addTableSql('vip_subscriptions', data.vip_subscriptions);
addTableSql('referral_transactions', data.referral_transactions);
addTableSql('messages', data.messages);
addTableSql('push_subscriptions', data.push_subscriptions);
addTableSql('payouts', data.payouts);

// Re-enable triggers
sql += 'SET session_replication_role = DEFAULT;\n';

writeFileSync('./supabase/migrations/20260608000001_seed.sql', sql);
console.log('Seed SQL generated.');
