const { execSync } = require('child_process');

const envs = {
  NEXT_PUBLIC_SUPABASE_URL: "https://bhunvginzhgnwjkprnxc.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJodW52Z2luemhnbndqa3BybnhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwOTY2MzEsImV4cCI6MjA5NDY3MjYzMX0.luCf4n-WYdH31hir7TD9lv_eWJSyiQrdDzdGq2BBBWo",
  SUPABASE_SERVICE_ROLE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJodW52Z2luemhnbndqa3BybnhjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTA5NjYzMSwiZXhwIjoyMDk0NjcyNjMxfQ.7UBdq5wPsc5ViD9SeL7pPfYrEoE3rsXxU6jrykfDhco"
};

for (const [key, value] of Object.entries(envs)) {
  for (const env of ['production', 'preview', 'development']) {
    try {
      console.log(`Setting ${key} for ${env}...`);
      execSync(`npx vercel env add ${key} ${env} -y`, { 
        input: value,
        stdio: ['pipe', 'ignore', 'pipe'] 
      });
    } catch (e) {
      if (e.stderr && e.stderr.toString().includes('already exists')) {
        console.log(`${key} already exists for ${env}. Removing and re-adding...`);
        execSync(`npx vercel env rm ${key} ${env} -y`);
        execSync(`npx vercel env add ${key} ${env} -y`, { 
          input: value,
          stdio: ['pipe', 'ignore', 'pipe'] 
        });
      } else {
        console.error(`Failed to set ${key} for ${env}`);
      }
    }
  }
}
console.log('Environment variables updated.');
