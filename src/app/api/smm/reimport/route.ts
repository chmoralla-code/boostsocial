import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { parseDescription } from "@/utils/serviceHelpers";
import { syncBackupAdminClients } from "@/utils/supabase/dual-db";
import { getMarkupMultiplier } from "@/lib/markupConfig";

const RIXEYSMM_API_URL = "https://rixeysmm.shop/api/v2";

interface CoreServiceConfig {
  dbId: string;
  name: string;
  platform: string;
  type: string;
  keywords: string[];
}

const CORE_SERVICES: { [key: string]: CoreServiceConfig } = {
  fb_followers: { dbId: "6ef1e136-c2c8-4719-8c12-b0f20504d15e", name: "FB FOLLOWERS", platform: "facebook", type: "followers", keywords: ["follower", "followers"] },
  fb_reactions: { dbId: "37b37203-2c37-4fd3-a0bb-0f5393f49c1c", name: "FB REACTIONS", platform: "facebook", type: "likes", keywords: ["reaction", "reactions", "like", "likes", "react", "reacts"] },
  fb_views: { dbId: "5a383d04-281e-4d46-8366-799a0053a67c", name: "FB VIEWS", platform: "facebook", type: "views", keywords: ["view", "views", "play", "plays"] },
  ig_followers: { dbId: "46a89c42-2d12-40e9-b5fc-112f45ea2e88", name: "IG FOLLOWERS", platform: "instagram", type: "followers", keywords: ["follower", "followers"] },
  ig_likes: { dbId: "ccb4766f-1249-43c2-a9b0-410a62abde12", name: "IG LIKES", platform: "instagram", type: "likes", keywords: ["like", "likes"] },
  ig_views: { dbId: "d50c76ab-8422-4936-a36c-27940ea56ac1", name: "IG VIEWS", platform: "instagram", type: "views", keywords: ["view", "views"] },
  tiktok_followers: { dbId: "2a98f123-1d42-45e3-82ef-fb347cda6541", name: "TIKTOK FOLLOWERS", platform: "tiktok", type: "followers", keywords: ["follower", "followers"] },
  tiktok_likes: { dbId: "f78ab471-29cf-4ab8-9366-410adfac56a2", name: "TIKTOK LIKES", platform: "tiktok", type: "likes", keywords: ["like", "likes", "heart", "hearts"] },
  tiktok_views: { dbId: "c4a7e936-d2bc-45aa-bb36-ab3cfda836cf", name: "TIKTOK VIEWS", platform: "tiktok", type: "views", keywords: ["view", "views", "play", "plays"] },
  yt_subscribers: { dbId: "ab348d21-f123-45c1-bd76-e137fab62aa1", name: "YT SUBSCRIBERS", platform: "youtube", type: "subscribers", keywords: ["subscriber", "subscribers"] },
  yt_likes: { dbId: "67a3f892-db42-4751-bb38-410adfac29b1", name: "YT LIKES", platform: "youtube", type: "likes", keywords: ["like", "likes"] },
  yt_views: { dbId: "57f3ab71-7c98-46ab-bbef-b31cfa286ac1", name: "YT VIEWS", platform: "youtube", type: "views", keywords: ["view", "views"] },
};

function parseAvgTime(t: string | undefined | null): number {
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

function isPlatform(name: string, cat: string, platform: string): boolean {
  const n = name.toLowerCase(), c = cat.toLowerCase();
  if (platform === "facebook") {
    const isFB = n.includes("facebook") || n.includes("fb") || c.includes("facebook") || c.includes("fb");
    if (!isFB) return false;
    return !(n.includes("instagram") || n.includes("ig ") || n.includes(" ig") || n.includes("tiktok") || n.includes("tik tok") || n.includes("youtube") || n.includes("yt ") || n.includes(" yt") || n.includes("twitter") || n.includes("twitch") || n.includes("telegram") || c.includes("instagram") || c.includes("tiktok") || c.includes("youtube") || c.includes("twitter") || c.includes("twitch") || c.includes("telegram"));
  }
  if (platform === "instagram") {
    const isIG = n.includes("instagram") || n.includes("ig") || c.includes("instagram") || c.includes("ig");
    if (!isIG) return false;
    return !(n.includes("facebook") || n.includes("fb") || n.includes("tiktok") || n.includes("tik tok") || n.includes("youtube") || n.includes("yt ") || n.includes(" yt") || n.includes("twitter") || n.includes("twitch") || n.includes("telegram") || c.includes("facebook") || c.includes("tiktok") || c.includes("youtube") || c.includes("twitter") || c.includes("twitch") || c.includes("telegram"));
  }
  if (platform === "tiktok") {
    const isTT = n.includes("tiktok") || n.includes("tik tok") || c.includes("tiktok") || c.includes("tik tok");
    if (!isTT) return false;
    return !(n.includes("facebook") || n.includes("fb") || n.includes("instagram") || n.includes("ig ") || n.includes(" ig") || n.includes("youtube") || n.includes("yt ") || n.includes(" yt") || n.includes("twitter") || n.includes("twitch") || n.includes("telegram") || c.includes("facebook") || c.includes("instagram") || c.includes("youtube") || c.includes("twitter") || c.includes("twitch") || c.includes("telegram"));
  }
  if (platform === "youtube") {
    const isYT = n.includes("youtube") || n.includes("yt") || c.includes("youtube") || c.includes("yt");
    if (!isYT) return false;
    return !(n.includes("facebook") || n.includes("fb") || n.includes("instagram") || n.includes("ig ") || n.includes(" ig") || n.includes("tiktok") || n.includes("tik tok") || n.includes("twitter") || n.includes("twitch") || n.includes("telegram") || c.includes("facebook") || c.includes("instagram") || c.includes("tiktok") || c.includes("twitter") || c.includes("twitch") || c.includes("telegram"));
  }
  return false;
}

function matchType(name: string, cat: string, config: CoreServiceConfig): boolean {
  const n = name.toLowerCase(), c = cat.toLowerCase();
  const kw = config.keywords;
  const matchesKeyword = kw.some(k => n.includes(k) || c.includes(k));
  if (!matchesKeyword) return false;

  if (config.type === "followers" || config.type === "subscribers") {
    return !(n.includes("like") || n.includes("reaction") || n.includes("view") || n.includes("play") || n.includes("comment") || n.includes("share") || n.includes("watch"));
  }
  if (config.type === "likes") {
    if (n.includes("story") && config.platform === "facebook") return false;
    return !(n.includes("follower") || n.includes("subscriber") || n.includes("view") || n.includes("play") || n.includes("comment") || n.includes("share"));
  }
  if (config.type === "views") {
    return !(n.includes("follower") || n.includes("subscriber") || n.includes("like") || n.includes("reaction") || n.includes("comment") || n.includes("share"));
  }
  return false;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const providedApiKey = body.apiKey?.replace(/['"\r\n]/g, "").trim();
    const envApiKey = process.env.RIXEYSMM_API_KEY?.replace(/['"\r\n]/g, "").trim();
    const apiKey = providedApiKey || envApiKey;

    if (!apiKey) {
      return NextResponse.json({ error: "No RixeySMM API key provided or set in env" }, { status: 500 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Server Supabase configuration missing" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const markupMultiplier = await getMarkupMultiplier();

    // 1. Fetch all RixeySMM services
    const res = await fetch(RIXEYSMM_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ key: apiKey, action: "services" }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) throw new Error(`RixeySMM API failed with status ${res.status}`);
    const smmServices: any[] = await res.json();
    if (!Array.isArray(smmServices)) throw new Error("Invalid response format from RixeySMM");

    // 2. Fetch public average times
    const averageTimes: { [key: string]: string } = {};
    try {
      const pageRes = await fetch("https://rixeysmm.shop/services", { signal: AbortSignal.timeout(10000) });
      if (pageRes.ok) {
        const html = await pageRes.text();
        const regex = /data-filter-table-service-id="(\d+)"/g;
        let match;
        while ((match = regex.exec(html)) !== null) {
          const serviceIdStr = match[1];
          const startIndex = match.index;
          const startTr = html.lastIndexOf("<tr", startIndex);
          const endTr = html.indexOf("</tr>", startIndex);
          if (startTr !== -1 && endTr !== -1 && startTr < startIndex) {
            const trHtml = html.substring(startTr, endTr);
            const cells = trHtml.split(/<td[^>]*>/i);
            if (cells.length >= 7) {
              averageTimes[serviceIdStr] = cells[6].split("</td>")[0].trim();
            }
          }
        }
      }
    } catch (e) {
      console.warn("Failed to fetch public average times:", e);
    }

    // 3. Find cheapest+fastest for each core service
    const syncResults: any = {};
    const platformBestPrices: { [platform: string]: { service: string; ratePer1k: number; retailPer1k: number; name: string; avgTime: string } } = {};

    for (const [key, config] of Object.entries(CORE_SERVICES)) {
      const candidates = smmServices.filter(s => {
        const name = s.name || "", cat = s.category || "", desc = s.desc || "";
        if (!isPlatform(name, cat, config.platform)) return false;
        if (!matchType(name, cat, config)) return false;
        const nd = name.toLowerCase() + desc.toLowerCase();
        if (nd.includes("no data") || nd.includes("no speed")) return false;
        return true;
      });

      // Sort by cheapest rate first, then fastest avg time as tiebreaker
      // Don't exclude services without avg time data — just deprioritize them
      candidates.sort((a, b) => {
        const rateDiff = Number(a.rate) - Number(b.rate);
        if (rateDiff !== 0) return rateDiff;
        const atA = averageTimes[String(a.service)];
        const atB = averageTimes[String(b.service)];
        const hasA = atA && !atA.toLowerCase().includes("not enough data");
        const hasB = atB && !atB.toLowerCase().includes("not enough data");
        if (hasA && !hasB) return -1;
        if (!hasA && hasB) return 1;
        return parseAvgTime(atA) - parseAvgTime(atB);
      });

      const best = candidates[0];
      if (!best) {
        syncResults[key] = { success: false, error: "No suitable service found" };
        continue;
      }

      const smmRate = Number(best.rate);
      const smmServiceId = best.service;
      const calculatedPerPiece = (smmRate / 1000) * markupMultiplier;
      const retailPer1k = smmRate * markupMultiplier;

      // Update DB service
      const { data: dbService } = await supabase
        .from("services")
        .select("description")
        .eq("id", config.dbId)
        .maybeSingle();

      let descriptionObj: any = {};
      if (dbService?.description) {
        const parsed = parseDescription(dbService.description);
        if (parsed) descriptionObj = parsed;
        else descriptionObj = { description: dbService.description };
      }

      descriptionObj.smm_service_id = smmServiceId;
      descriptionObj.smm_original_rate = smmRate;
      descriptionObj.smm_markup_percent = Math.round((markupMultiplier - 1) * 100);
      descriptionObj.smm_original_name = best.name;
      descriptionObj.min_quantity = Number(best.min);
      descriptionObj.smm_min = Number(best.min);
      descriptionObj.smm_max = Number(best.max);
      descriptionObj.smm_average_time = averageTimes[String(smmServiceId)] || "No data";

      const { error: updateErr } = await supabase
        .from("services")
        .update({ starting_price: calculatedPerPiece, description: JSON.stringify(descriptionObj) })
        .eq("id", config.dbId);

      await syncBackupAdminClients(async (backupClient) => {
        await backupClient
          .from("services")
          .update({ starting_price: calculatedPerPiece, description: JSON.stringify(descriptionObj) })
          .eq("id", config.dbId);
      }, "reimport-smm services update");

      syncResults[key] = {
        success: !updateErr,
        smmServiceId,
        smmRate,
        smmOriginalName: best.name,
        newStartingPrice: calculatedPerPiece,
        retailPer1k: Math.round(retailPer1k * 100) / 100,
        avgTime: averageTimes[String(smmServiceId)] || "No data",
        error: updateErr?.message,
      };

      // Track the best price per platform for candidate updates
      // Use followers/subscribers as the "starting rate" for the platform card
      if (config.type === "followers" || config.type === "subscribers") {
        platformBestPrices[config.platform] = {
          service: String(smmServiceId),
          ratePer1k: smmRate,
          retailPer1k: Math.round(retailPer1k * 100) / 100,
          name: best.name,
          avgTime: averageTimes[String(smmServiceId)] || "No data",
        };
      }
    }

    // 4. Update candidate services' rate_text with actual cheapest prices
    const { data: candidatesData } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "services_candidates")
      .single();

    let candidates: any[] = [];
    if (candidatesData?.value && Array.isArray(candidatesData.value)) {
      candidates = candidatesData.value;
    } else {
      // Use defaults from the services-candidates route
      candidates = [];
    }

    const candidateUpdates: any = {};
    for (const candidate of candidates) {
      if (!candidate || typeof candidate !== "object") continue;
      const platformMap: { [id: string]: string } = {
        facebook: "facebook",
        instagram: "instagram",
        tiktok: "tiktok",
        youtube: "youtube",
      };
      const platform = platformMap[candidate.id];
      if (platform && platformBestPrices[platform]) {
        const best = platformBestPrices[platform];
        const oldRate = candidate.rate_text;
        candidate.rate_text = `₱${best.retailPer1k.toFixed(2)} per 1k boosts`;
        candidate.smm_service_id = best.service;
        candidateUpdates[candidate.id] = { old: oldRate, new: candidate.rate_text, smmService: best.service };
      }
    }

    if (candidates.length > 0) {
      const { error: candErr } = await supabase
        .from("settings")
        .upsert({ key: "services_candidates", value: candidates, updated_at: new Date().toISOString() }, { onConflict: "key" });

      await syncBackupAdminClients(async (backupClient) => {
        await backupClient
          .from("settings")
          .upsert({ key: "services_candidates", value: candidates, updated_at: new Date().toISOString() }, { onConflict: "key" });
      }, "reimport-smm candidates update");

      if (candErr) {
        console.error("Failed to update candidates:", candErr.message);
      }
    }

    return NextResponse.json({
      success: true,
      totalServicesPulled: smmServices.length,
      averageTimesParsed: Object.keys(averageTimes).length,
      markupMultiplier,
      syncResults,
      candidateUpdates,
    });
  } catch (err: any) {
    console.error("Reimport SMM failed:", err);
    return NextResponse.json({ error: err.message || err.toString() }, { status: 500 });
  }
}
