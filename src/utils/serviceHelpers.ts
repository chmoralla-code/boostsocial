/**
 * Safely parses the description of a service.
 * The description can be stored as stringified JSON in the database,
 * but Supabase or dual database setup might return it pre-parsed as an object.
 */
export function parseDescription(desc: any): any {
  if (!desc) return null;
  if (typeof desc === "object") return desc;
  if (typeof desc === "string" && desc.trim().startsWith("{")) {
    try {
      return JSON.parse(desc);
    } catch (e) {
      // Fallback in case string format is not valid JSON.
    }
  }
  return null;
}

/**
 * Classifies whether a service is Organic (strictly PH Base local profiles)
 * or Non-Organic (standard automated profiles).
 */
export function isOrganic(name: string, desc: string = ""): boolean {
  const combined = `${name} ${desc}`.toLowerCase();
  return combined.includes("ph base") || combined.includes("ph-base");
}

export function isUtilityService(name: string, desc: string = "", category: string = ""): boolean {
  const combined = `${name} ${desc} ${category}`.toLowerCase();
  const utilityKeywords = [
    "gemini",
    "eap",
    "tp-link",
    "tplink",
    "piso wifi",
    "pisowifi",
    "router",
    "software",
    "license",
    "architectural",
    "autocad",
    "sketchup",
    "subscription",
    "membership",
    "netflix",
    "canva",
    "chatgpt",
    "office 365",
    "windows key",
    "vps",
    "hosting",
    "domain"
  ];

  return utilityKeywords.some((keyword) => combined.includes(keyword));
}

export function isSocialBoostService(name: string, desc: string = "", category: string = ""): boolean {
  const combined = `${name} ${desc} ${category}`.toLowerCase();
  const socialPatterns = [
    /\bfacebook\b/,
    /\bfb\b/,
    /\binstagram\b/,
    /\big\b/,
    /\btiktok\b/,
    /\byoutube\b/,
    /\byt\b/,
    /\btwitter\b/,
    /\btelegram\b/,
    /\bthreads\b/,
    /\btwitch\b/,
    /\bspotify\b/,
    /\bdiscord\b/,
    /\breddit\b/,
    /\blinkedin\b/,
    /\bpinterest\b/,
    /\bsnapchat\b/
  ];

  return socialPatterns.some((pattern) => pattern.test(combined));
}

export function matchesServiceQualityFilter(
  name: string,
  desc: string = "",
  category: string = "",
  organicOnly: boolean
): boolean {
  if (isUtilityService(name, desc, category) || !isSocialBoostService(name, desc, category)) {
    return false;
  }

  const phBase = isOrganic(name, `${desc} ${category}`);
  return organicOnly ? phBase : !phBase;
}

/**
 * Formats and shortens SMM service names dynamically.
 * Pattern: [Short Name] - ID [ID] (Avg: [Average Time])
 */
export function formatSmmServiceName(name: string, id: string | number, desc: string = ""): string {
  const combined = `${name} ${desc}`.toLowerCase();
  let short = name
    .replace(/^\[.*?\]\s*/g, "")
    .replace(/[|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const platform =
    combined.match(/\bfacebook\b|\bfb\b/) ? "FB" :
    combined.match(/\binstagram\b|\big\b/) ? "IG" :
    combined.includes("tiktok") ? "TikTok" :
    combined.match(/\byoutube\b|\byt\b/) ? "YT" :
    combined.includes("twitter") ? "Twitter" :
    combined.includes("telegram") ? "Telegram" :
    combined.includes("threads") ? "Threads" :
    combined.includes("twitch") ? "Twitch" :
    combined.includes("spotify") ? "Spotify" :
    "";

  const serviceType =
    combined.includes("subscriber") ? "Subs" :
    combined.includes("follower") ? "Followers" :
    combined.includes("reaction") || combined.includes("react") ? "Reactions" :
    combined.includes("heart") ? "Hearts" :
    combined.includes("like") ? "Likes" :
    combined.includes("view") || combined.includes("play") ? "Views" :
    combined.includes("comment") ? "Comments" :
    combined.includes("share") ? "Shares" :
    combined.includes("save") || combined.includes("favorite") ? "Saves" :
    combined.includes("member") ? "Members" :
    combined.includes("watch hour") ? "Watch Hours" :
    "Boost";

  const qualifiers: string[] = [];
  if (isOrganic(name, desc)) qualifiers.push("PH Base");
  if (combined.includes("high quality") || combined.includes(" hq") || combined.includes("[hq]")) qualifiers.push("HQ");
  if (combined.includes("non drop") || combined.includes("non-drop")) qualifiers.push("ND");
  if (combined.includes("refill")) qualifiers.push("Refill");
  if (combined.includes("live")) qualifiers.push("Live");
  if (combined.includes("reel")) qualifiers.push("Reels");
  if (combined.includes("shorts") || combined.includes("short ")) qualifiers.push("Shorts");

  if (platform || serviceType !== "Boost" || qualifiers.length > 0) {
    short = [platform, serviceType, ...qualifiers].filter(Boolean).join(" ");
  }

  let avgTime = "Instant";
  const explicitHourRange = combined.match(/(?:avg|average|start|time|within)?\s*:?\s*(\d+)\s*[-\u2013]\s*(\d+)\s*(?:h|hr|hrs|hour|hours)\b/);
  const explicitDayRange = combined.match(/(?:avg|average|start|time|within)?\s*:?\s*(\d+)\s*[-\u2013]\s*(\d+)\s*(?:d|day|days)\b/);
  const minuteMatch = combined.match(/(\d+)\s*[-\u2013]?\s*(?:min|mins|minute|minutes)\b/);

  if (explicitHourRange) {
    avgTime = `${explicitHourRange[1]}-${explicitHourRange[2]}h`;
  } else if (explicitDayRange) {
    avgTime = `${explicitDayRange[1]}-${explicitDayRange[2]}d`;
  } else if (minuteMatch) {
    avgTime = `${minuteMatch[1]}m`;
  } else if (combined.includes("0-1h") || combined.includes("within 1 hour") || combined.includes("within 1h")) {
    avgTime = "<1h";
  } else if (combined.includes("0-12h") || combined.includes("within 12 hours") || combined.includes("within 12h")) {
    avgTime = "<12h";
  } else if (combined.includes("0-24h") || combined.includes("within 24 hours") || combined.includes("within 24h")) {
    avgTime = "<24h";
  } else if (combined.includes("slow") || combined.includes("gradual")) {
    avgTime = "Gradual";
  }

  const compactName = short.length > 52 ? `${short.slice(0, 49).trim()}...` : short;
  return `${compactName.trim()} - ID ${id} (Avg: ${avgTime})`;
}
