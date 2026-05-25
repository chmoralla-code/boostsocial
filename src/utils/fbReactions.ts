export interface FBReactionConfig {
  smmId: number;
  rate: number; // reseller rate per 1k in PHP
}

export const FB_REACTIONS_MAP: Record<string, FBReactionConfig> = {
  "Like": { smmId: 2860, rate: 4.49 },  // Facebook Post Likes - 30D Refill
  "Love": { smmId: 3021, rate: 5.68 },  // Facebook Post Reactions - Love - No Refill
  "Care": { smmId: 3022, rate: 5.68 },  // Facebook Post Reactions - Care - No Refill
  "Haha": { smmId: 3023, rate: 5.68 },  // Facebook Post Reactions - Haha - No Refill
  "Wow": { smmId: 3024, rate: 5.68 },   // Facebook Post Reactions - Wow - No Refill
  "Sad": { smmId: 3025, rate: 5.68 },   // Facebook Post Reactions - Sad - No Refill
  "Angry": { smmId: 3026, rate: 5.68 }, // Facebook Post Reactions - Angry - No Refill
};

/**
 * Resolves the precise SMM Service ID and Reseller rate based on selected Facebook reactions.
 * If only 1 reaction is chosen, returns its cheap individual service rate.
 * If multiple reactions are selected, maps to the appropriate RixeySMM mixed reaction package.
 */
export function getFBReactionsSMMDetails(selected: string[]): { smmId: number; rate: number } {
  if (!selected || selected.length === 0) {
    return FB_REACTIONS_MAP["Like"];
  }

  if (selected.length === 1) {
    const type = selected[0];
    return FB_REACTIONS_MAP[type] || FB_REACTIONS_MAP["Like"];
  }

  // Multiple reactions selected (mixed reactions).
  // All RixeySMM mixed post reaction packages cost ₱34.49/1k reseller rate.
  // We resolve the appropriate mixed package ID based on count.
  const hasLike = selected.includes("Like");
  const hasLove = selected.includes("Love");
  const hasCare = selected.includes("Care");
  const hasHaha = selected.includes("Haha");
  const hasWow = selected.includes("Wow");

  if (selected.length === 2 && hasLike && hasLove) {
    return { smmId: 1961, rate: 34.49 };
  } else if (selected.length === 3 && hasLike && hasLove && hasCare) {
    return { smmId: 1962, rate: 34.49 };
  } else if (selected.length === 4 && hasLike && hasLove && hasCare && hasHaha) {
    return { smmId: 1963, rate: 34.49 };
  } else if (selected.length === 5 && hasLike && hasLove && hasCare && hasHaha && hasWow) {
    return { smmId: 1964, rate: 34.49 };
  } else {
    // If it's a full mix or any other complex combinations
    return { smmId: 1965, rate: 34.49 };
  }
}

/**
 * Calculates the retail price per single reaction (piece) in PHP based on standard markup (x2 reseller price).
 */
export function getFBReactionRetailPrice(selected: string[]): number {
  const details = getFBReactionsSMMDetails(selected);
  return (details.rate / 1000) * 2; // Standard markup factor = 2.0
}
