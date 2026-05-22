const RIXEYSMM_API_URL = "https://rixeysmm.shop/api/v2";
const apiKey = '8527e5fc153203f0884d44e9afc3be17';

function isTargetPlatform(name, cat, platform) {
  const n = name.toLowerCase();
  const c = cat.toLowerCase();
  
  if (platform === "tiktok") {
    const isTT = n.includes("tiktok") || n.includes("tt") || n.includes("tik tok") || c.includes("tiktok") || c.includes("tt") || c.includes("tik tok");
    return isTT;
  }
  return false;
}

async function main() {
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

  const res = await fetch(RIXEYSMM_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ key: apiKey, action: "services" }),
  });
  
  const smmServices = await res.json();
  console.log("Total SMM services fetched:", smmServices.length);
  
  const ttServices = smmServices.filter(s => {
    const name = (s.name || "").toLowerCase();
    const cat = (s.category || "").toLowerCase();
    return isTargetPlatform(name, cat, "tiktok");
  });
  
  console.log(`TikTok services: ${ttServices.length}`);
  
  // Filter for followers keywords
  const followersCandidates = ttServices.filter(s => {
    const name = (s.name || "").toLowerCase();
    const cat = (s.category || "").toLowerCase();
    return name.includes("follower") || name.includes("followers") || cat.includes("follower") || cat.includes("followers");
  });
  
  console.log(`Followers candidates before other exclusions: ${followersCandidates.length}`);
  followersCandidates.slice(0, 15).forEach(s => {
    const avgTime = averageTimes[s.service] || "Not found";
    console.log(`- Service ID: ${s.service} | Name: ${s.name} | Category: ${s.category} | Avg Time: "${avgTime}"`);
  });
}

main();
