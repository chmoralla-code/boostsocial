import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bhunvginzhgnwjkprnxc.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJodW52Z2luemhnbndqa3BybnhjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTA5NjYzMSwiZXhwIjoyMDk0NjcyNjMxfQ.7UBdq5wPsc5ViD9SeL7pPfYrEoE3rsXxU6jrykfDhco';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createAdmin() {
  const { data, error } = await supabase.auth.admin.createUser({
    email: 'admin@boostsocial.com',
    password: 'Password123!',
    email_confirm: true,
  });

  if (error) {
    if (error.message.includes('already registered')) {
        console.log('Admin user already exists.');
    } else {
        console.error('Error creating admin:', error.message);
    }
  } else {
    console.log('Admin user created:', data.user.email);
    
    // Set profile role
    await supabase.from('profiles').insert({
        id: data.user.id,
        role: 'admin',
        full_name: 'Admin User'
    });
    console.log('Profile created with admin role.');
  }
}

createAdmin();
