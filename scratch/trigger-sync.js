const url = 'http://localhost:3000/api/admin/sync-smm-services';

async function main() {
  console.log('Synchronizing SMM services dynamically...');
  
  // We can call the API handler directly by importing it or running it locally via next dev,
  // but since next dev isn't running yet, we can import the endpoint logic or mock it and run!
  // Even better, let's just write a direct node script that runs the exact same code
  // as the api route, so we can verify it immediately!
  
  const { createClient } = require('@supabase/supabase-js');
  
  const supabaseUrl = 'https://bhunvginzhgnwjkprnxc.supabase.co';
  const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJodW52Z2luemhnbndqa3BybnhjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTA5NjYzMSwiZXhwIjoyMDk0NjcyNjMxfQ.7UBdq5wPsc5ViD9SeL7pPfYrEoE3rsXxU6jrykfDhco';
  const apiKey = '8527e5fc153203f0884d44e9afc3be17';
  
  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  const CORE_SERVICES = {
    followers: {
      dbId: "6ef1e136-c2c8-4719-8c12-b0f20504d15e",
      name: "FB FOLLOWERS",
      keywords: ["follower", "profile", "page"],
    },
    reactions: {
      dbId: "37b37203-2c37-4fd3-a0bb-0f5393f49c1c",
      name: "FB REACTIONS",
      keywords: ["reaction", "like", "react"],
    },
    views: {
      dbId: "5a383d04-281e-4d46-8366-799a0053a67c",
      name: "FB VIEWS",
      keywords: ["view", "play", "plays"],
    }
  };

  try {
    const res = await fetch('https://rixeysmm.shop/api/v2', {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ key: apiKey, action: "services" }),
    });
    
    const smmServices = await res.json();
    const markup = 60; // 60% ROI markup
    const syncResults = {};

    for (const [key, config] of Object.entries(CORE_SERVICES)) {
      const candidates = smmServices.filter(s => {
        const name = (s.name || "").toLowerCase();
        const cat = (s.category || "").toLowerCase();
        const desc = (s.desc || "").toLowerCase();

        const isFB = name.includes("facebook") || name.includes("fb") || cat.includes("facebook") || cat.includes("fb");
        if (!isFB) return false;

        const isOtherNetwork = name.includes("instagram") || name.includes("tiktok") || name.includes("twitter") || 
                               name.includes("youtube") || name.includes("twitch") || name.includes("linkedin") || 
                               name.includes("telegram") || name.includes("thread") || name.includes("threads") ||
                               cat.includes("instagram") || cat.includes("tiktok") || cat.includes("twitter") || 
                               cat.includes("youtube") || cat.includes("twitch") || cat.includes("linkedin") || 
                               cat.includes("telegram");
        if (isOtherNetwork) return false;

        const matchesKeyword = config.keywords.some(kw => name.includes(kw) || cat.includes(kw));
        if (!matchesKeyword) return false;

        const isNoData = name.includes("no data") || name.includes("no speed") || desc.includes("no data") || desc.includes("no speed");
        if (isNoData) return false;

        const speedKeywords = ["min", "minute", "speed", "day", "instant", "plays", "/d", "/day", "1k", "per min"];
        const hasSpeed = speedKeywords.some(kw => name.includes(kw) || desc.includes(kw));
        return hasSpeed;
      });

      if (candidates.length === 0) {
        console.log(`No candidates for ${config.name}`);
        continue;
      }

      candidates.sort((a, b) => Number(a.rate) - Number(b.rate));
      const cheapest = candidates[0];
      const smmRate = Number(cheapest.rate);
      const calculatedPerPiece = (smmRate / 1000) * (1 + markup / 100);

      console.log(`Syncing ${config.name}: Cheapest SMM ID is ${cheapest.service} (${cheapest.name}) costing ${smmRate} PHP/1k. Calc per-pc price: ${calculatedPerPiece}`);

      const { data: dbService } = await supabase
        .from("services")
        .select("description")
        .eq("id", config.dbId)
        .single();

      let descriptionObj = {};
      try {
        if (dbService.description && dbService.description.trim().startsWith("{")) {
          descriptionObj = JSON.parse(dbService.description);
        } else {
          descriptionObj = { description: dbService.description };
        }
      } catch (e) {
        descriptionObj = { description: dbService.description };
      }

      descriptionObj.smm_service_id = cheapest.service;
      descriptionObj.smm_original_rate = smmRate;
      descriptionObj.smm_markup_percent = markup;
      descriptionObj.smm_original_name = cheapest.name;
      descriptionObj.smm_min = Number(cheapest.min);
      descriptionObj.smm_max = Number(cheapest.max);

      const { error: updateErr } = await supabase
        .from("services")
        .update({
          starting_price: calculatedPerPiece,
          description: JSON.stringify(descriptionObj)
        })
        .eq("id", config.dbId);

      if (updateErr) {
        console.error(`Update error for ${config.name}:`, updateErr.message);
      } else {
        console.log(`Successfully synced ${config.name}!`);
      }
    }
  } catch (err) {
    console.error(err);
  }
}

main();
