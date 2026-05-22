const RIXEYSMM_API_URL = "https://rixeysmm.shop/api/v2";

const CORE_SERVICES = {
  followers: {
    name: "FB FOLLOWERS",
    keywords: ["follower", "profile", "page"],
  },
  reactions: {
    name: "FB REACTIONS",
    keywords: ["reaction", "like", "react"],
  },
  views: {
    name: "FB VIEWS",
    keywords: ["view", "play", "plays"],
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

async function main() {
  const apiKey = process.env.RIXEYSMM_API_KEY;
  if (!apiKey) {
    console.error("Missing RIXEYSMM_API_KEY");
    return;
  }

  try {
    // 1. Fetch public average times
    console.log("Fetching public services page...");
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
    console.log("Total parsed average times:", Object.keys(averageTimes).length);

    // 2. Fetch SMM services API list
    console.log("Fetching API services list...");
    const res = await fetch(RIXEYSMM_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        key: apiKey,
        action: "services",
      }),
    });
    const smmServices = await res.json();

    for (const [key, config] of Object.entries(CORE_SERVICES)) {
      console.log(`\n========================================`);
      console.log(`Filtering candidates for: ${config.name}`);
      console.log(`========================================`);

      const candidates = smmServices.filter(s => {
        const name = (s.name || "").toLowerCase();
        const cat = (s.category || "").toLowerCase();
        const desc = (s.desc || "").toLowerCase();

        // Must be Facebook
        const isFB = name.includes("facebook") || name.includes("fb") || cat.includes("facebook") || cat.includes("fb");
        if (!isFB) return false;

        // Exclude other networks
        const isOtherNetwork = name.includes("instagram") || name.includes("tiktok") || name.includes("twitter") || 
                               name.includes("youtube") || name.includes("twitch") || name.includes("linkedin") || 
                               name.includes("telegram") || name.includes("thread") || name.includes("threads") ||
                               cat.includes("instagram") || cat.includes("tiktok") || cat.includes("twitter") || 
                               cat.includes("youtube") || cat.includes("twitch") || cat.includes("linkedin") || 
                               cat.includes("telegram");
        if (isOtherNetwork) return false;

        // Keywords match
        const matchesKeyword = config.keywords.some(kw => name.includes(kw) || cat.includes(kw));
        if (!matchesKeyword) return false;

        // Exclude no data / no speed
        const isNoData = name.includes("no data") || name.includes("no speed") || desc.includes("no data") || desc.includes("no speed");
        if (isNoData) return false;

        // Must have speed / time data in name or description
        const speedKeywords = ["min", "minute", "speed", "day", "instant", "plays", "/d", "/day", "1k", "per min"];
        const hasSpeed = speedKeywords.some(kw => name.includes(kw) || desc.includes(kw));
        if (!hasSpeed) return false;

        // NEW: Average Time data check!
        const avgTime = averageTimes[s.service];
        if (!avgTime || avgTime.toLowerCase().includes("not enough data")) {
          return false;
        }

        return true;
      });

      console.log(`Found candidates with valid average time data:`, candidates.length);
      if (candidates.length > 0) {
        // Calculate combined score for each candidate
        candidates.forEach(c => {
          const minutes = parseAverageTimeToMinutes(averageTimes[c.service]);
          c.minutes = minutes;
          // Score = Rate * (1 + minutes / 1440)
          c.score = Number(c.rate) * (1 + minutes / 1440);
        });

        // Sort by combined score ascending
        candidates.sort((a, b) => a.score - b.score);
        console.log("Top 5 candidates by combined score (Cheapest & Shortest Time):");
        candidates.slice(0, 5).forEach(c => {
          console.log(`- Service ID: ${c.service} | Name: ${c.name} | Rate: ₱${c.rate} | Avg Time: "${averageTimes[c.service]}" (Score: ${c.score.toFixed(2)})`);
        });
      } else {
        console.log("❌ No candidate has valid average time data!");
      }
    }
  } catch (err) {
    console.error(err);
  }
}

main();
