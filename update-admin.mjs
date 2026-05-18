import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bhunvginzhgnwjkprnxc.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJodW52Z2luemhnbndqa3BybnhjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTA5NjYzMSwiZXhwIjoyMDk0NjcyNjMxfQ.7UBdq5wPsc5ViD9SeL7pPfYrEoE3rsXxU6jrykfDhco';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function updateAdmin() {
  const email = 'admin@boostsocial.com';
  
  // 1. Get the user by email
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error('Error listing users:', listError);
    return;
  }

  const user = users.find(u => u.email === email);

  if (user) {
    // 2. Update password
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      { password: 'admin1234' }
    );
    if (updateError) {
        console.error('Error updating password:', updateError);
    } else {
        console.log('Admin password updated successfully.');
    }
  } else {
    // 3. Create if not exists
    const { data, error } = await supabase.auth.admin.createUser({
        email: email,
        password: 'admin1234',
        email_confirm: true,
    });
    if (error) {
        console.error('Error creating admin:', error);
    } else {
        console.log('Admin created successfully.');
        await supabase.from('profiles').insert({
            id: data.user.id,
            role: 'admin',
            full_name: 'Admin User'
        });
    }
  }
}

updateAdmin();
