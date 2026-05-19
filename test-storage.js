require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function checkStorage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.log("Missing credentials.");
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  });

  try {
    // Try to list files
    const { data: files, error: listError } = await supabase.storage.from('receipts').list();
    if (listError) throw listError;

    let totalSizeBytes = 0;
    if (files) {
      files.forEach(file => {
        if (file.metadata && file.metadata.size) {
          totalSizeBytes += file.metadata.size;
        }
      });
    }
    
    console.log(`Total files: ${files?.length || 0}`);
    console.log(`Total size: ${(totalSizeBytes / 1024 / 1024).toFixed(2)} MB`);
    
  } catch (err) {
    console.error(err);
  }
}

checkStorage();
