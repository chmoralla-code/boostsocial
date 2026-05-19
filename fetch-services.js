const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://bhunvginzhgnwjkprnxc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJodW52Z2luemhnbndqa3BybnhjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTA5NjYzMSwiZXhwIjoyMDk0NjcyNjMxfQ.7UBdq5wPsc5ViD9SeL7pPfYrEoE3rsXxU6jrykfDhco';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function main() {
  const { data, error } = await supabase.from('services').select('*').order('created_at', { ascending: true });
  if (error) {
    console.error(error);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

main();
