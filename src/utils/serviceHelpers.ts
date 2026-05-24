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
