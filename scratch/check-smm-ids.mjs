import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing env keys");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  const { data: services, error } = await supabase
    .from("services")
    .select("id, title, starting_price, description");
    
  if (error) {
    console.error("Fetch error:", error);
    process.exit(1);
  }
  
  console.log("Services list:");
  for (const s of services) {
    let smmId = "None";
    let originalRate = "None";
    try {
      if (s.description && s.description.trim().startsWith("{")) {
        const parsed = JSON.parse(s.description);
        smmId = parsed.smm_service_id || "None";
        originalRate = parsed.smm_original_rate || "None";
      }
    } catch (e) {}
    console.log(`- Title: ${s.title} | ID: ${s.id} | SMM Service ID: ${smmId} | Reseller Rate: ${originalRate}`);
  }
}

run();
