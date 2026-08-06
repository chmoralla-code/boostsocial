const { execFileSync } = require('child_process');

const requiredKeys = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
];

const envs = Object.fromEntries(
  requiredKeys.map((key) => {
    const value = process.env[key];
    if (!value) {
      throw new Error(`Missing ${key} in the current shell environment.`);
    }
    return [key, value];
  })
);

for (const [key, value] of Object.entries(envs)) {
  for (const target of ['production', 'preview', 'development']) {
    console.log(`Setting ${key} for ${target}...`);
    execFileSync(
      'npx',
      ['vercel', 'env', 'add', key, target, '--force', '--yes'],
      {
        input: value,
        stdio: ['pipe', 'ignore', 'inherit'],
        shell: process.platform === 'win32',
      }
    );
  }
}

console.log('Environment variables updated.');
