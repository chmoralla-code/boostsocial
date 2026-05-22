const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://bhunvginzhgnwjkprnxc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJodW52Z2luemhnbndqa3BybnhjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTA5NjYzMSwiZXhwIjoyMDk0NjcyNjMxfQ.7UBdq5wPsc5ViD9SeL7pPfYrEoE3rsXxU6jrykfDhco';
const apiKey = '8527e5fc153203f0884d44e9afc3be17';

const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

const CORE_SERVICES = {
  // Facebook
  fb_followers: {
    dbId: "6ef1e136-c2c8-4719-8c12-b0f20504d15e",
    name: "FB FOLLOWERS",
    platform: "facebook",
    keywords: ["follower", "followers"],
  },
  fb_reactions: {
    dbId: "37b37203-2c37-4fd3-a0bb-0f5393f49c1c",
    name: "FB REACTIONS",
    platform: "facebook",
    keywords: ["reaction", "reactions", "like", "likes", "react", "reacts"],
  },
  fb_views: {
    dbId: "5a383d04-281e-4d46-8366-799a0053a67c",
    name: "FB VIEWS",
    platform: "facebook",
    keywords: ["view", "views", "play", "plays"],
  },
  // Instagram
  ig_followers: {
    dbId: "46a89c42-2d12-40e9-b5fc-112f45ea2e88",
    name: "IG FOLLOWERS",
    platform: "instagram",
    keywords: ["follower", "followers"],
  },
  ig_likes: {
    dbId: "ccb4766f-1249-43c2-a9b0-410a62abde12",
    name: "IG LIKES",
    platform: "instagram",
    keywords: ["like", "likes"],
  },
  ig_views: {
    dbId: "d50c76ab-8422-4936-a36c-27940ea56ac1",
    name: "IG VIEWS",
    platform: "instagram",
    keywords: ["view", "views"],
  },
  // TikTok
  tiktok_followers: {
    dbId: "2a98f123-1d42-45e3-82ef-fb347cda6541",
    name: "TIKTOK FOLLOWERS",
    platform: "tiktok",
    keywords: ["follower", "followers"],
  },
  tiktok_likes: {
    dbId: "f78ab471-29cf-4ab8-9366-410adfac56a2",
    name: "TIKTOK LIKES",
    platform: "tiktok",
    keywords: ["like", "likes", "heart", "hearts"],
  },
  tiktok_views: {
    dbId: "c4a7e936-d2bc-45aa-bb36-ab3cfda836cf",
    name: "TIKTOK VIEWS",
    platform: "tiktok",
    keywords: ["view", "views", "play", "plays"],
  },
  // YouTube
  yt_subscribers: {
    dbId: "ab348d21-f123-45c1-bd76-e137fab62aa1",
    name: "YT SUBSCRIBERS",
    platform: "youtube",
    keywords: ["subscriber", "subscribers"],
  },
  yt_likes: {
    dbId: "67a3f892-db42-4751-bb38-410adfac29b1",
    name: "YT LIKES",
    platform: "youtube",
    keywords: ["like", "likes"],
  },
  yt_views: {
    dbId: "57f3ab71-7c98-46ab-bbef-b31cfa286ac1",
    name: "YT VIEWS",
    platform: "youtube",
    keywords: ["view", "views"],
  }
};

function parseAverageTimeToMinutes(timeStr) {
  if (!timeStr) return Infinity;
  const str = timeStr.toLowerCase();
  if (str.includes("not enough data")) return Infinity;
  
  let totalMinutes = 0;
  
  const hoursMatch = str.match(/(\d+)\s*hour/);
  if (hoursMatch) {
    totalMinutes += parseInt(hoursMatch[1], 10) * 60;
  }
  
  const minutesMatch = str.match(/(\d+)\s*min/);
  if (minutesMatch) {
    totalMinutes += parseInt(minutesMatch[1], 10);
  }
  
  const daysMatch = str.match(/(\d+)\s*day/);
  if (daysMatch) {
    totalMinutes += parseInt(daysMatch[1], 10) * 24 * 60;
  }

  if (totalMinutes === 0) {
    const digitsOnly = str.match(/(\d+)/);
    if (digitsOnly) {
      totalMinutes = parseInt(digitsOnly[1], 10);
    } else {
      return Infinity;
    }
  }
  
  return totalMinutes;
}

function isTargetPlatform(name, cat, platform) {
  const n = name.toLowerCase();
  const c = cat.toLowerCase();
  
  if (platform === "facebook") {
    const isFB = n.includes("facebook") || n.includes("fb") || c.includes("facebook") || c.includes("fb");
    if (!isFB) return false;
    
    const isOther = n.includes("instagram") || n.includes("ig ") || n.includes(" ig") || n.includes("tiktok") || n.includes("tik tok") ||
                    n.includes("youtube") || n.includes("yt ") || n.includes(" yt") || n.includes("twitter") || n.includes("twitch") ||
                    c.includes("instagram") || c.includes("tiktok") || c.includes("youtube") || c.includes("twitter") || c.includes("twitch");
    return !isOther;
  }
  
  if (platform === "instagram") {
    const isIG = n.includes("instagram") || n.includes("ig") || c.includes("instagram") || c.includes("ig");
    if (!isIG) return false;
    
    const isOther = n.includes("facebook") || n.includes("fb") || n.includes("tiktok") || n.includes("tik tok") ||
                    n.includes("youtube") || n.includes("yt ") || n.includes(" yt") || n.includes("twitter") || n.includes("twitch") ||
                    c.includes("facebook") || c.includes("tiktok") || c.includes("youtube") || c.includes("twitter") || c.includes("twitch");
    return !isOther;
  }
  
  if (platform === "tiktok") {
    const isTT = n.includes("tiktok") || n.includes("tt") || n.includes("tik tok") || c.includes("tiktok") || c.includes("tt") || c.includes("tik tok");
    if (!isTT) return false;
    
    const isOther = n.includes("facebook") || n.includes("fb") || n.includes("instagram") || n.includes("ig ") || n.includes(" ig") ||
                    n.includes("youtube") || n.includes("yt ") || n.includes(" yt") || n.includes("twitter") || n.includes("twitch") ||
                    c.includes("facebook") || c.includes("instagram") || c.includes("youtube") || c.includes("twitter") || c.includes("twitch");
    return !isOther;
  }
  
  if (platform === "youtube") {
    const isYT = n.includes("youtube") || n.includes("yt") || c.includes("youtube") || c.includes("yt");
    if (!isYT) return false;
    
    const isOther = n.includes("facebook") || n.includes("fb") || n.includes("instagram") || n.includes("ig ") || n.includes(" ig") ||
                    n.includes("tiktok") || n.includes("tik tok") || n.includes("twitter") || n.includes("twitch") ||
                    c.includes("facebook") || c.includes("instagram") || c.includes("tiktok") || c.includes("twitter") || c.includes("twitch");
    return !isOther;
  }
  
  return false;
}

function matchesExactly(name, cat, desc, config) {
  const n = name.toLowerCase();
  const c = cat.toLowerCase();

  // 1. Must contain at least one matching keyword
  const matchesKeyword = config.keywords.some(kw => n.includes(kw) || c.includes(kw));
  if (!matchesKeyword) return false;

  // 2. Exclude broad words depending on config.name
  if (config.name.includes("FOLLOWERS") || config.name.includes("SUBSCRIBERS")) {
    if (n.includes("like") || n.includes("reaction") || n.includes("view") || n.includes("play") || n.includes("comment") || n.includes("share") || n.includes("watch time")) return false;
    if (c.includes("like") || c.includes("reaction") || c.includes("view") || c.includes("play") || c.includes("comment") || c.includes("share")) return false;
  }
  
  if (config.name.includes("LIKES") || config.name.includes("REACTIONS")) {
    if (n.includes("follower") || n.includes("subscriber") || n.includes("view") || n.includes("play") || n.includes("comment") || n.includes("share")) return false;
    if (c.includes("follower") || c.includes("subscriber") || c.includes("view") || c.includes("play") || c.includes("comment") || c.includes("share")) return false;
  }

  if (config.name.includes("VIEWS")) {
    if (n.includes("follower") || n.includes("subscriber") || n.includes("like") || n.includes("reaction") || n.includes("comment") || n.includes("share")) return false;
    if (c.includes("follower") || c.includes("subscriber") || c.includes("like") || c.includes("reaction") || c.includes("comment") || c.includes("share")) return false;
  }

  return true;
}

async function main() {
  console.log('Synchronizing SMM services dynamically for FB, IG, TikTok, YouTube (with exact cross-matching filters)...');
  
  try {
    const res = await fetch('https://rixeysmm.shop/api/v2', {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ key: apiKey, action: "services" }),
    });
    
    // Fetch public services page to get average time data
    console.log("Fetching public services page to get average times...");
    const pageRes = await fetch("https://rixeysmm.shop/services");
    const html = await pageRes.text();
    const averageTimes = {};
    const regex = /data-service-id="(\d+)"[\s\S]*?<td class="avarage_time_Services">([\s\S]*?)<\/td>/g;
    let match;
    while ((match = regex.exec(html)) !== null) {
      averageTimes[match[1]] = match[2].trim();
    }
    const fallbackRegex = /<span id="servis_id" class="order_id">(\d+)<\/span>[\s\S]*?<td class="avarage_time_Services">([\s\S]*?)<\/td>/g;
    while ((match = fallbackRegex.exec(html)) !== null) {
      averageTimes[match[1]] = match[2].trim();
    }
    console.log(`Parsed average times for ${Object.keys(averageTimes).length} services.`);

    const smmServices = await res.json();
    const markup = 60; // 60% ROI markup

    for (const [key, config] of Object.entries(CORE_SERVICES)) {
      console.log(`Filtering candidates for: ${config.name}`);
      const candidates = smmServices.filter(s => {
        const name = (s.name || "").toLowerCase();
        const cat = (s.category || "").toLowerCase();
        const desc = (s.desc || "").toLowerCase();

        // Check target platform
        if (!isTargetPlatform(name, cat, config.platform)) return false;

        // Keywords and cross-type exclusions match
        if (!matchesExactly(name, cat, desc, config)) return false;

        const isNoData = name.includes("no data") || name.includes("no speed") || desc.includes("no data") || desc.includes("no speed");
        if (isNoData) return false;

        const speedKeywords = ["min", "minute", "speed", "day", "instant", "plays", "/d", "/day", "1k", "per min", "fast", "hour", "hours", "rapid", "stable"];
        const hasSpeed = speedKeywords.some(kw => name.includes(kw) || desc.includes(kw));
        if (!hasSpeed) return false;

        // Exclude services without valid average time data (Not enough data)
        const serviceIdStr = String(s.service);
        const avgTime = averageTimes[serviceIdStr];
        if (!avgTime || avgTime.toLowerCase().includes("not enough data")) {
          return false;
        }

        return true;
      });

      if (candidates.length === 0) {
        console.log(`❌ No candidates for ${config.name}. Clearing old SMM sync fields in database.`);
        const { data: dbService, error: fetchErr } = await supabase
          .from("services")
          .select("description")
          .eq("id", config.dbId)
          .maybeSingle();

        if (!fetchErr && dbService) {
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

          delete descriptionObj.smm_service_id;
          delete descriptionObj.smm_original_rate;
          delete descriptionObj.smm_markup_percent;
          delete descriptionObj.smm_original_name;
          delete descriptionObj.smm_min;
          delete descriptionObj.smm_max;
          delete descriptionObj.smm_average_time;

          await supabase
            .from("services")
            .update({
              description: JSON.stringify(descriptionObj)
            })
            .eq("id", config.dbId);
        }
        continue;
      }

      // Sort candidates by combined score ascending: Score = Rate * (1 + minutes / 1440)
      candidates.sort((a, b) => {
        const minutesA = parseAverageTimeToMinutes(averageTimes[String(a.service)]);
        const minutesB = parseAverageTimeToMinutes(averageTimes[String(b.service)]);
        const scoreA = Number(a.rate) * (1 + minutesA / 1440);
        const scoreB = Number(b.rate) * (1 + minutesB / 1440);
        return scoreA - scoreB;
      });
      const cheapest = candidates[0];
      const smmRate = Number(cheapest.rate);
      const calculatedPerPiece = (smmRate / 1000) * (1 + markup / 100);

      console.log(`Syncing ${config.name}: Cheapest/Fastest SMM ID is ${cheapest.service} (${cheapest.name}) costing ${smmRate} PHP/1k. Avg time: ${averageTimes[String(cheapest.service)]}. Calc per-pc price: ${calculatedPerPiece}`);

      const { data: dbService, error: fetchErr } = await supabase
        .from("services")
        .select("description")
        .eq("id", config.dbId)
        .maybeSingle();

      if (fetchErr || !dbService) {
        console.error(`❌ Could not fetch service ${config.name} with ID ${config.dbId} from database.`);
        continue;
      }

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
      descriptionObj.smm_average_time = averageTimes[String(cheapest.service)] || "No data";

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
