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
      // Fallback in case string format is not valid JSON
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
  // Return true ONLY if it contains "ph base" or "ph-base"
  return combined.includes("ph base") || combined.includes("ph-base");
}

/**
 * Formats and shortens SMM service names dynamically.
 * Pattern: [Short Name] - ID [ID] (Avg Time: [Average Time])
 */
export function formatSmmServiceName(name: string, id: string | number, desc: string = ""): string {
  let short = name;

  // Remove common prefix categories or ID patterns
  short = short.replace(/^\[.*?\]\s*/g, ""); // Remove bracketed prefixes like [SMM]
  
  // Shorten platforms
  short = short.replace(/\bfacebook\b/gi, "FB");
  short = short.replace(/\binstagram\b/gi, "IG");
  short = short.replace(/\byoutube\b/gi, "YT");
  short = short.replace(/\btiktok\b/gi, "TikTok");
  short = short.replace(/\btwitter\b/gi, "Twitter");
  short = short.replace(/\btelegram\b/gi, "Telegram");

  // Shorten common terms
  short = short.replace(/\bfollowers\b/gi, "Followers");
  short = short.replace(/\bfollower\b/gi, "Follower");
  short = short.replace(/\bsubscribers\b/gi, "Subs");
  short = short.replace(/\bsubscriber\b/gi, "Sub");
  short = short.replace(/\blikes\b/gi, "Likes");
  short = short.replace(/\blike\b/gi, "Like");
  short = short.replace(/\breactions\b/gi, "Reactions");
  short = short.replace(/\breaction\b/gi, "Reaction");
  short = short.replace(/\bviews\b/gi, "Views");
  short = short.replace(/\bview\b/gi, "View");
  short = short.replace(/\bcomments\b/gi, "Comments");
  short = short.replace(/\bcomment\b/gi, "Comment");
  short = short.replace(/\bmembers\b/gi, "Members");
  short = short.replace(/\bmember\b/gi, "Member");
  short = short.replace(/\bnon drop\b/gi, "ND");
  short = short.replace(/\bnon-drop\b/gi, "ND");
  short = short.replace(/\blifetime refill\b/gi, "♾️ Refill");
  short = short.replace(/\brefill\b/gi, "Refill");
  short = short.replace(/\bhigh quality\b/gi, "HQ");
  short = short.replace(/\bstable\b/gi, "Stable");
  short = short.replace(/\binstant\b/gi, "Instant");

  // Extract average time data from description or name
  let avgTime = "⚡ Instant";
  const combined = `${name} ${desc}`.toLowerCase();
  if (combined.includes("0-1h") || combined.includes("within 1 hour") || combined.includes("within 1h")) {
    avgTime = "⏱️ < 1h";
  } else if (combined.includes("0-12h") || combined.includes("within 12 hours") || combined.includes("within 12h")) {
    avgTime = "⏱️ < 12h";
  } else if (combined.includes("0-24h") || combined.includes("within 24 hours") || combined.includes("within 24h")) {
    avgTime = "⏱️ < 24h";
  } else if (combined.includes("slow") || combined.includes("gradual")) {
    avgTime = "⏱️ Gradual";
  }

  return `${short.trim()} - ID ${id} (Avg Time: ${avgTime})`;
}

