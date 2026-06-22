import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const RIXEYSMM_API_URL = "https://rixeysmm.shop/api/v2";

type PlatformAvailability = {
  facebook: boolean;
  instagram: boolean;
  tiktok: boolean;
  youtube: boolean;
  telegram: boolean;
  twitter: boolean;
  updatedAt: string;
};

let cachedAvailability: PlatformAvailability | null = null;
let lastCheckTime = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

function classifyPlatform(category: string, name: string): string | null {
  const text = `${category} ${name}`.toLowerCase();
  if (text.includes("facebook") || text.includes("fb ")) return "facebook";
  if (text.includes("instagram") || text.includes("ig ")) return "instagram";
  if (text.includes("tiktok") || text.includes("tik tok")) return "tiktok";
  if (text.includes("youtube") || text.includes("yt ")) return "youtube";
  if (text.includes("telegram")) return "telegram";
  if (text.includes("twitter") || text.includes("x ")) return "twitter";
  return null;
}

async function fetchAvailability(): Promise<PlatformAvailability> {
  const now = Date.now();
  if (cachedAvailability && now - lastCheckTime < CACHE_TTL) {
    return cachedAvailability;
  }

  const apiKey = process.env.RIXEYSMM_API_KEY?.replace(/['"\r\n]/g, "").trim();

  if (!apiKey) {
    // No API key — fall back to checking stored DB services
    return fetchFromDB();
  }

  try {
    const res = await fetch(RIXEYSMM_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ key: apiKey, action: "services" }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) throw new Error(`Status ${res.status}`);

    const services = await res.json();
    if (!Array.isArray(services)) throw new Error("Invalid format");

    const platforms: PlatformAvailability = {
      facebook: false,
      instagram: false,
      tiktok: false,
      youtube: false,
      telegram: false,
      twitter: false,
      updatedAt: new Date().toISOString(),
    };

    for (const s of services) {
      const platform = classifyPlatform(s.category || "", s.name || "");
      if (platform && platform in platforms && platform !== "updatedAt") {
        (platforms as Record<string, boolean | string>)[platform] = true;
      }
    }

    cachedAvailability = platforms;
    lastCheckTime = now;
    return platforms;
  } catch (err) {
    console.error("RixeySMM availability check failed:", err);
    if (cachedAvailability) return cachedAvailability;
    return fetchFromDB();
  }
}

async function fetchFromDB(): Promise<PlatformAvailability> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return {
      facebook: true, instagram: true, tiktok: true,
      youtube: true, telegram: true, twitter: true,
      updatedAt: new Date().toISOString(),
    };
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { data } = await supabase.from("services").select("title, description");

  const platforms: PlatformAvailability = {
    facebook: false, instagram: false, tiktok: false,
    youtube: false, telegram: false, twitter: false,
    updatedAt: new Date().toISOString(),
  };

  for (const s of data || []) {
    const platform = classifyPlatform("", s.title || "");
    if (platform && platform in platforms && platform !== "updatedAt") {
      (platforms as Record<string, boolean | string>)[platform] = true;
    }
  }

  return platforms;
}

export async function GET() {
  try {
    const availability = await fetchAvailability();
    return NextResponse.json(availability);
  } catch (err) {
    console.error("Availability check failed:", err);
    return NextResponse.json({
      facebook: true, instagram: true, tiktok: true,
      youtube: true, telegram: true, twitter: true,
      updatedAt: new Date().toISOString(),
    });
  }
}
