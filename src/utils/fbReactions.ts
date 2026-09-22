export interface FBReactionConfig {
  smmId: number;
  rate: number; // reseller rate per 1k in PHP
}

/**
 * Facebook post-reaction service mapping on RixeySMM.
 *
 * Verified live against the provider catalog (`action=services`, 1079 services).
 * The previous mapping pointed at provider IDs 2860 / 3021-3026 / 1961-1965,
 * all of which have been delisted — every reaction order was failing during
 * placement with a `Failed: ...` external status.
 *
 * Current family: #1086-#1092 "Facebook Post Reaction | <Type> | Max 1M |
 * HQ Accounts | Speed 10k Day" — all seven types at a uniform 5.80 PHP per 1k.
 */
export const FB_REACTIONS_MAP: Record<string, FBReactionConfig> = {
  "Like": { smmId: 1086, rate: 5.80 }, // Facebook Post Reaction | Like | Max 1M | HQ Accounts | Speed 10k Day
  "Love": { smmId: 1087, rate: 5.80 },  // Facebook Post Reaction | Love | Max 1M | HQ Accounts | Speed 10k Day
  "Care": { smmId: 1088, rate: 5.80 },  // Facebook Post Reaction | Care | Max 1M | HQ Accounts | Speed 10k Day
  "Haha": { smmId: 1089, rate: 5.80 },  // Facebook Post Reaction | Haha | Max 1M | HQ Accounts | Speed 10k Day
  "Wow": { smmId: 1090, rate: 5.80 },   // Facebook Post Reaction | Wow | Max 1M | HQ Accounts | Speed 10k Day
  "Sad": { smmId: 1091, rate: 5.80 },   // Facebook Post Reaction | Sad | Max 1M | HQ Accounts | Speed 10k Day
  "Angry": { smmId: 1092, rate: 5.80 }, // Facebook Post Reaction | Angry | Max 1M | HQ Accounts | Speed 10k Day
};

/**
 * RixeySMM no longer lists a Facebook *mixed* (multi-reaction) service — the
 * old #1961-#1965 packages are gone and nothing comparable is offered. A
 * specific mix of reactions therefore cannot be fulfilled as one provider
 * order, so `getFBReactionsSMMDetails` reports it as `isMixed` with a null
 * `smmId` and callers reject it before an order is created.
 */
export const MIXED_REACTIONS_UNAVAILABLE_MESSAGE =
  "Mixed reaction orders are temporarily unavailable. Please pick a single reaction type (Like, Love, Care, Haha, Wow, Sad or Angry).";

export type FBReactionDetails = {
  /** Provider service id, or null when the selection cannot be placed as-is. */
  smmId: number | null;
  rate: number;
  isMixed: boolean;
};

/**
 * Resolves the precise SMM Service ID and reseller rate based on selected reactions.
 * Returns `smmId: null` / `isMixed: true` when more than one reaction is chosen,
 * because no single provider service can deliver a specific mix.
 */
export function getFBReactionsSMMDetails(selected: string[]): FBReactionDetails {
  const chosen = (selected || []).filter(Boolean);

  if (chosen.length === 0) {
    const like = FB_REACTIONS_MAP["Like"];
    return { smmId: like.smmId, rate: like.rate, isMixed: false };
  }

  if (chosen.length === 1) {
    const config = FB_REACTIONS_MAP[chosen[0]] || FB_REACTIONS_MAP["Like"];
    return { smmId: config.smmId, rate: config.rate, isMixed: false };
  }

  const highestRate = Math.max(
    ...chosen.map((name) => FB_REACTIONS_MAP[name]?.rate ?? FB_REACTIONS_MAP["Like"].rate)
  );
  return { smmId: null, rate: highestRate, isMixed: true };
}

/**
 * Calculates the retail price per single reaction (piece) in PHP based on the
 * given markup multiplier. Defaults to 3.0x for backward compatibility.
 */
export function getFBReactionRetailPrice(selected: string[], markupMultiplier: number = 3.0): number {
  const details = getFBReactionsSMMDetails(selected);
  return (details.rate / 1000) * markupMultiplier;
}
