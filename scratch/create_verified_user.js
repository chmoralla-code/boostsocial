const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read .env.local variables
const envPath = path.join(__dirname, '../.env.local');
const lines = fs.readFileSync(envPath, 'utf8').split('\n');
const env = {};
lines.forEach(l => {
  const p = l.split('=');
  if(p[0]) env[p[0].trim()] = p[1].trim();
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing environment variables!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false
  }
});

async function main() {
  const targetEmail = 'cyrhiel2024@gmail.com';
  const targetPassword = 'Baholobot12345';

  console.log(`Checking if user ${targetEmail} exists in database auth schema...`);
  
  // List users to check for existence
  const { data, error: listError } = await supabase.auth.admin.listUsers();
  
  if (listError) {
    console.error("Failed to fetch user list:", listError);
    process.exit(1);
  }

  const existingUser = data.users.find(u => u.email === targetEmail);

  if (existingUser) {
    console.log(`User already exists (ID: ${existingUser.id}). Updating password and manually marking email as confirmed...`);
    const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(
      existingUser.id,
      { 
        password: targetPassword,
        email_confirm: true
      }
    );
    if (updateError) {
      console.error("Failed to update user status:", updateError);
    } else {
      console.log("✨ SUCCESS: Existing user's password updated and email manually confirmed!");
    }
  } else {
    console.log(`User does not exist. Creating verified user programmatically...`);
    const { data: createData, error: createError } = await supabase.auth.admin.createUser({
      email: targetEmail,
      password: targetPassword,
      email_confirm: true
    });
    if (createError) {
      console.error("Failed to create verified user:", createError);
    } else {
      console.log("✨ SUCCESS: Verified user account created successfully!");
    }
  }
}

main();
