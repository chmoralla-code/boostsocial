const fs = require("fs");
const services = JSON.parse(fs.readFileSync("rixeysmm_services.json", "utf8"));

function parseAvgTime(t) {
  if (!t) return Infinity;
  const s = t.toLowerCase();
  if (s.includes("not enough data")) return Infinity;
  let m = 0;
  const d = s.match(/(\d+)\s*day/); if (d) m += +d[1] * 1440;
  const h = s.match(/(\d+)\s*hour/); if (h) m += +h[1] * 60;
  const mn = s.match(/(\d+)\s*min/); if (mn) m += +mn[1];
  if (m === 0) { const dig = s.match(/(\d+)/); if (dig) m = +dig[1]; else return Infinity; }
  return m;
}

function isPlatform(name, cat, platform) {
  const n = name.toLowerCase(), c = cat.toLowerCase();
  const platforms = {
    facebook: () => (n.includes("facebook") || n.includes("fb") || c.includes("facebook") || c.includes("fb")) &&
      !(n.includes("instagram") || n.includes("ig ") || n.includes(" ig") || n.includes("tiktok") || n.includes("youtube") || n.includes("twitter") || n.includes("telegram") || c.includes("instagram") || c.includes("tiktok") || c.includes("youtube")),
    instagram: () => (n.includes("instagram") || n.includes("ig") || c.includes("instagram") || c.includes("ig")) &&
      !(n.includes("facebook") || n.includes("fb") || n.includes("tiktok") || n.includes("youtube") || n.includes("twitter") || c.includes("facebook") || c.includes("tiktok") || c.includes("youtube")),
    tiktok: () => (n.includes("tiktok") || n.includes("tik tok") || c.includes("tiktok")) &&
      !(n.includes("facebook") || n.includes("fb") || n.includes("instagram") || n.includes("youtube") || n.includes("twitter") || c.includes("facebook") || c.includes("instagram") || c.includes("youtube")),
    youtube: () => (n.includes("youtube") || n.includes("yt") || c.includes("youtube")) &&
      !(n.includes("facebook") || n.includes("fb") || n.includes("instagram") || n.includes("tiktok") || n.includes("twitter") || c.includes("facebook") || c.includes("instagram") || c.includes("tiktok")),
  };
  return platforms[platform] ? platforms[platform]() : false;
}

function matchType(name, cat, type) {
  const n = name.toLowerCase(), c = cat.toLowerCase();
  if (type === "followers") {
    return (n.includes("follower") || c.includes("follower")) && !(n.includes("like") || n.includes("reaction") || n.includes("view") || n.includes("comment") || n.includes("share") || n.includes("watch"));
  }
  if (type === "likes") {
    return (n.includes("like") || n.includes("heart") || c.includes("like") || c.includes("heart")) && !(n.includes("follower") || n.includes("subscriber") || n.includes("view") || n.includes("comment") || n.includes("share"));
  }
  if (type === "views") {
    return (n.includes("view") || n.includes("play") || c.includes("view") || c.includes("play")) && !(n.includes("follower") || n.includes("subscriber") || n.includes("like") || n.includes("reaction") || n.includes("comment") || n.includes("share"));
  }
  if (type === "subscribers") {
    return (n.includes("subscriber") || n.includes("sub ") || c.includes("subscriber")) && !(n.includes("like") || n.includes("view") || n.includes("comment") || n.includes("share") || n.includes("watch"));
  }
  return false;
}

const platforms = ["facebook", "instagram", "tiktok", "youtube"];
const types = { facebook: ["followers", "likes", "views"], instagram: ["followers", "likes", "views"], tiktok: ["followers", "likes", "views"], youtube: ["subscribers", "likes", "views"] };

const results = {};
for (const platform of platforms) {
  results[platform] = {};
  for (const type of types[platform]) {
    const candidates = services.filter(s => {
      const name = s.name || "", cat = s.category || "", desc = s.desc || "";
      if (!isPlatform(name, cat, platform)) return false;
      if (!matchType(name, cat, type)) return false;
      const nd = name.toLowerCase() + desc.toLowerCase();
      if (nd.includes("no data") || nd.includes("no speed")) return false;
      return true;
    });

    // Sort by cheapest rate first, then fastest avg time
    candidates.sort((a, b) => {
      const rateDiff = Number(a.rate) - Number(b.rate);
      if (rateDiff !== 0) return rateDiff;
      return parseAvgTime(a.average_time) - parseAvgTime(b.average_time);
    });

    const best = candidates[0];
    if (best) {
      results[platform][type] = {
        service: best.service,
        name: best.name,
        category: best.category,
        rate: Number(best.rate),
        ratePer1k: Number(best.rate),
        min: best.min,
        max: best.max,
        avgTime: best.average_time || "N/A",
        avgTimeMinutes: parseAvgTime(best.average_time),
      };
    } else {
      results[platform][type] = null;
    }
  }
}

// Also find top 5 cheapest+fastest for each to show alternatives
console.log("=== CHEAPEST + FASTEST SERVICES PER PLATFORM/TYPE ===\n");
for (const platform of platforms) {
  console.log(`\n--- ${platform.toUpperCase()} ---`);
  for (const type of types[platform]) {
    const r = results[platform][type];
    if (r) {
      console.log(`  ${type}: #${r.service} | ₱${r.ratePer1k}/1k | ${r.avgTime} | "${r.name}"`);
    } else {
      console.log(`  ${type}: NOT FOUND`);
    }
  }
}

// Show top 3 for each for reference
console.log("\n\n=== TOP 3 CHEAPEST PER PLATFORM/TYPE ===\n");
for (const platform of platforms) {
  for (const type of types[platform]) {
    const candidates = services.filter(s => {
      const name = s.name || "", cat = s.category || "", desc = s.desc || "";
      if (!isPlatform(name, cat, platform)) return false;
      if (!matchType(name, cat, type)) return false;
      const nd = name.toLowerCase() + desc.toLowerCase();
      if (nd.includes("no data") || nd.includes("no speed")) return false;
      return true;
    }).sort((a, b) => Number(a.rate) - Number(b.rate)).slice(0, 3);

    console.log(`\n${platform} ${type}:`);
    candidates.forEach((c, i) => {
      console.log(`  ${i+1}. #${c.service} | ₱${c.rate}/1k | ${c.average_time || "N/A"} | "${c.name}"`);
    });
  }
}

fs.writeFileSync("rixeysmm_best.json", JSON.stringify(results, null, 2));
console.log("\n\nSaved best services to rixeysmm_best.json");
