import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required env vars: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

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
