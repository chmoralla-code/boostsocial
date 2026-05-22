import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

const RIXEYSMM_API_URL = "https://rixeysmm.shop/api/v2";

export async function POST(req: NextRequest) {
  try {
    const { markupPercent } = await req.json();
    const markup = markupPercent !== undefined ? Number(markupPercent) : 60; // default to 60% markup

    if (isNaN(markup) || markup < 0) {
      return NextResponse.json({ error: "Invalid markup percentage" }, { status: 400 });
    }

    const apiKey = process.env.RIXEYSMM_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "RixeySMM API Key is missing on the server" }, { status: 500 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Server Supabase configuration missing" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    // 1. Fetch RixeySMM services
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

    if (!res.ok) {
      throw new Error(`RixeySMM API failed with status ${res.status}`);
    }

    const smmServices: any[] = await res.json();
    if (!Array.isArray(smmServices)) {
      throw new Error("Invalid response format from RixeySMM");
    }

    const syncResults: any = {};

    // 2. Process each core service type
    for (const [key, config] of Object.entries(CORE_SERVICES)) {
      // Filter SMM services
      const candidates = smmServices.filter(s => {
        const name = (s.name || "").toLowerCase();
        const cat = (s.category || "").toLowerCase();
        const desc = (s.desc || "").toLowerCase();

        // Must be Facebook / FB
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

        // Must have data minutes / speed indicator
        const speedKeywords = ["min", "minute", "speed", "day", "instant", "plays", "/d", "/day", "1k", "per min"];
        const hasSpeed = speedKeywords.some(kw => name.includes(kw) || desc.includes(kw));
        return hasSpeed;
      });

      if (candidates.length === 0) {
        syncResults[key] = { success: false, error: "No suitable SMM service candidate found" };
        continue;
      }

      // Sort candidates by rate ascending
      candidates.sort((a, b) => Number(a.rate) - Number(b.rate));
      const cheapest = candidates[0];

      const smmRate = Number(cheapest.rate); // per 1000
      const smmServiceId = cheapest.service;
      
      // Calculate per-piece starting price with markup
      // our_price_per_piece = (smm_rate / 1000) * (1 + markup / 100)
      const calculatedPerPiece = (smmRate / 1000) * (1 + markup / 100);

      // Fetch the current service row in the database
      const { data: dbService, error: fetchErr } = await supabase
        .from("services")
        .select("description")
        .eq("id", config.dbId)
        .maybeSingle();

      if (fetchErr || !dbService) {
        syncResults[key] = { success: false, error: "Service record not found in Supabase" };
        continue;
      }

      // Parse existing description
      let descriptionObj: any = {};
      try {
        if (dbService.description && dbService.description.trim().startsWith("{")) {
          descriptionObj = JSON.parse(dbService.description);
        } else {
          descriptionObj = { description: dbService.description };
        }
      } catch (e) {
        descriptionObj = { description: dbService.description };
      }

      // Merge SMM sync attributes
      descriptionObj.smm_service_id = smmServiceId;
      descriptionObj.smm_original_rate = smmRate;
      descriptionObj.smm_markup_percent = markup;
      descriptionObj.smm_original_name = cheapest.name;
      descriptionObj.smm_min = Number(cheapest.min);
      descriptionObj.smm_max = Number(cheapest.max);

      // Update database starting_price and description payload
      const { error: updateErr } = await supabase
        .from("services")
        .update({
          starting_price: calculatedPerPiece,
          description: JSON.stringify(descriptionObj)
        })
        .eq("id", config.dbId);

      if (updateErr) {
        syncResults[key] = { success: false, error: `Supabase update failed: ${updateErr.message}` };
      } else {
        syncResults[key] = {
          success: true,
          smmServiceId,
          smmRate,
          smmOriginalName: cheapest.name,
          newStartingPrice: calculatedPerPiece,
          markupPercent: markup
        };
      }
    }

    return NextResponse.json({ success: true, results: syncResults });
  } catch (err: any) {
    console.error("SMM Dynamic sync failed:", err);
    return NextResponse.json({ error: err.message || err.toString() }, { status: 500 });
  }
}
