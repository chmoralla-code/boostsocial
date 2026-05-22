const RIXEYSMM_API_URL = "https://rixeysmm.shop/api/v2";
const apiKey = '8527e5fc153203f0884d44e9afc3be17';

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
  
  const tiktokFollowers = smmServices.filter(s => {
    const name = (s.name || "").toLowerCase();
    const cat = (s.category || "").toLowerCase();
    const isTT = name.includes("tiktok") || cat.includes("tiktok");
    const isFollowers = name.includes("follower") || cat.includes("follower");
    return isTT && isFollowers;
  });
  
  console.log("Total TikTok followers services found:", tiktokFollowers.length);
  const withData = tiktokFollowers.filter(s => {
    const avgTime = averageTimes[s.service];
    return avgTime && !avgTime.toLowerCase().includes("not enough data");
  });
  console.log("TikTok followers with average time data:", withData.length);
  withData.forEach(s => {
    console.log(`- ID: ${s.service} | Name: ${s.name} | Avg Time: "${averageTimes[s.service]}"`);
  });

  const youtubeSubs = smmServices.filter(s => {
    const name = (s.name || "").toLowerCase();
    const cat = (s.category || "").toLowerCase();
    const isYT = name.includes("youtube") || cat.includes("youtube");
    const isSubs = name.includes("subscriber") || cat.includes("subscriber");
    return isYT && isSubs;
  });
  console.log("\nTotal YouTube subscribers services found:", youtubeSubs.length);
  const ytWithData = youtubeSubs.filter(s => {
    const avgTime = averageTimes[s.service];
    return avgTime && !avgTime.toLowerCase().includes("not enough data");
  });
  console.log("YouTube subscribers with average time data:", ytWithData.length);
  ytWithData.forEach(s => {
    console.log(`- ID: ${s.service} | Name: ${s.name} | Avg Time: "${averageTimes[s.service]}"`);
  });
}

main();
