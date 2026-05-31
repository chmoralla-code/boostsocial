export type ReferralTier = {
  id: "basic" | "pro" | "elite";
  name: string;
  minSpend: number;
  orderRate: number;
  topupRate: number;
  shortDescription: string;
};

export const REFERRAL_MIN_PAYOUT = 100;

export const REFERRAL_TIERS: ReferralTier[] = [
  {
    id: "basic",
    name: "Basic Reseller",
    minSpend: 0,
    orderRate: 0.05,
    topupRate: 0.1,
    shortDescription: "Start earning right away.",
  },
  {
    id: "pro",
    name: "Pro Reseller",
    minSpend: 5000,
    orderRate: 0.1,
    topupRate: 0.12,
    shortDescription: "Unlocks after PHP 5,000 referral spend.",
  },
  {
    id: "elite",
    name: "Elite Reseller",
    minSpend: 20000,
    orderRate: 0.15,
    topupRate: 0.15,
    shortDescription: "Unlocks after PHP 20,000 referral spend.",
  },
];

export function formatReferralRate(rate: number) {
  return `${Math.round(rate * 100)}%`;
}

export function getReferralTier(lifetimeReferralSpend: number) {
  return REFERRAL_TIERS.reduce((activeTier, tier) => {
    return lifetimeReferralSpend >= tier.minSpend ? tier : activeTier;
  }, REFERRAL_TIERS[0]);
}

export function getNextReferralTier(lifetimeReferralSpend: number) {
  return REFERRAL_TIERS.find((tier) => lifetimeReferralSpend < tier.minSpend) || null;
}
