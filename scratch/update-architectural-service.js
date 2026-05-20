const { createClient } = require('@supabase/supabase-js');

async function updateService() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  const serviceId = '03185a81-49f3-4255-868e-9e9ec3189497';

  // Fetch current service details
  const { data: service, error: fetchError } = await supabase
    .from('services')
    .select('*')
    .eq('id', serviceId)
    .single();

  if (fetchError) {
    console.error("Error fetching service:", fetchError);
    return;
  }

  // Parse and update description JSON
  let parsedDesc = {};
  try {
    parsedDesc = JSON.parse(service.description);
  } catch (e) {
    console.error("Error parsing description JSON:", e);
    return;
  }

  // Set new values
  parsedDesc.free_trial_amount = 0; //Paid license has no trial
  parsedDesc.subtitle = "ARCHITECTURAL SOFTWARE";
  parsedDesc.button_text = "ADD";

  const updatedDescription = JSON.stringify(parsedDesc);

  const { data, error } = await supabase
    .from('services')
    .update({
      title: 'LIFETIME LICENSE',
      starting_price: 999,
      description: updatedDescription
    })
    .eq('id', serviceId)
    .select();

  if (error) {
    console.error("Error updating service:", error);
  } else {
    console.log("Successfully updated service in Supabase:", data);
  }
}
updateService();
