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
 * Classifies whether a service is Organic (real profiles, stable, high retention)
 * or Non-Organic (standard bot profiles, cost-effective automated plays).
 */
export function isOrganic(name: string, desc: string = ""): boolean {
  const combined = `${name} ${desc}`.toLowerCase();
  
  // Explicit standard bot keywords override organic detection
  if (
    combined.includes("bot") || 
    combined.includes("low quality") || 
    combined.includes("no refill") || 
    combined.includes("no-refill") ||
    combined.includes("unfiltered")
  ) {
    return false;
  }
  
  // Positive cues for organic, real, high retention profiles, digital tools, hardware, and premium licenses
  if (
    combined.includes("real") ||
    combined.includes("organic") ||
    combined.includes("non drop") ||
    combined.includes("non-drop") ||
    combined.includes("refill") ||
    combined.includes("high quality") ||
    combined.includes("hq") ||
    combined.includes("stable") ||
    combined.includes("lifetime") ||
    combined.includes("monetization") ||
    combined.includes("ph base") ||
    combined.includes("ph-base") ||
    combined.includes("genuine") ||
    combined.includes("active") ||
    combined.includes("gemini") ||
    combined.includes("pisowifi") ||
    combined.includes("eap") ||
    combined.includes("software") ||
    combined.includes("license")
  ) {
    return true;
  }
  
  return false;
}

