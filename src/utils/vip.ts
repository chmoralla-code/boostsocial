export type VipPlanId = "vip_starter" | "vip_pro" | "vip_royal";

export type VipProfileState = {
  vip_plan?: string | null;
  vip_expires_at?: string | null;
  vip_started_at?: string | null;
};

export type VipPlan = {
  id: VipPlanId;
  name: string;
  label: string;
  price: number;
  durationDays: number;
  discountPercent: number;
  perks: string[];
};

export const VIP_PLANS: VipPlan[] = [
  {
    id: "vip_starter",
    name: "Starter",
    label: "VIP Starter",
    price: 299,
    durationDays: 30,
    discountPercent: 10,
    perks: [
      "Priority support queue",
      "10% off all service orders",
      "Quick account verification",
    ],
  },
  {
    id: "vip_pro",
    name: "Pro",
    label: "VIP Pro",
    price: 699,
    durationDays: 30,
    discountPercent: 15,
    perks: [
      "Priority support lane",
      "15% off all service orders",
      "Faster queue processing",
      "Quarterly growth tips pack",
    ],
  },
  {
    id: "vip_royal",
    name: "Royal",
    label: "VIP Royal",
    price: 1499,
    durationDays: 30,
    discountPercent: 20,
    perks: [
      "Dedicated admin response line",
      "20% off all service orders",
      "Highest priority processing",
      "Advanced scaling templates",
      "Monthly optimization check-in",
    ],
  },
];

export function formatVipPlanDiscount(percent: number) {
  return `${percent}%`;
}

export function parseVipDate(value?: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function calculateVipExpiry(currentlyExpiresAt: string | null, durationDays: number) {
  const now = new Date();
  const baseline = parseVipDate(currentlyExpiresAt);
  const baseTime = baseline && baseline.getTime() > now.getTime() ? baseline : now;
  const next = new Date(baseTime);
  next.setDate(next.getDate() + durationDays);
  return next.toISOString();
}

export function getVipPlanById(planId?: string | null): VipPlan | null {
  return VIP_PLANS.find((plan) => plan.id === planId) ?? null;
}

export function isVipActive(profile: VipProfileState | null | undefined, now = new Date()) {
  const plan = getVipPlanById(profile?.vip_plan);
  if (!plan || !profile?.vip_expires_at) {
    return false;
  }

  const expiry = new Date(profile.vip_expires_at);
  if (Number.isNaN(expiry.getTime())) {
    return false;
  }

  return expiry.getTime() > now.getTime();
}

export function getActiveVipPlan(profile: VipProfileState | null | undefined) {
  return isVipActive(profile) ? getVipPlanById(profile?.vip_plan) : null;
}

export function getVipDiscountPercent(profile: VipProfileState | null | undefined): number {
  return getActiveVipPlan(profile)?.discountPercent ?? 0;
}

export function calculateVipDiscount(profile: VipProfileState | null | undefined, amount: number): number {
  const discountPercent = getVipDiscountPercent(profile);
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0 || discountPercent <= 0) {
    return Math.max(0, numericAmount || 0);
  }
  const discountMultiplier = (100 - discountPercent) / 100;
  return Number((numericAmount * discountMultiplier).toFixed(2));
}

export function getVipDiscountSummary(profile: VipProfileState | null | undefined, amount: number) {
  const plan = getActiveVipPlan(profile);
  const baseAmount = Number(amount);
  const activeDiscount = getVipDiscountPercent(profile);
  if (!plan || !Number.isFinite(baseAmount) || baseAmount <= 0 || activeDiscount <= 0) {
    return {
      plan: null,
      discountPercent: 0,
      originalAmount: baseAmount,
      finalAmount: Math.max(0, baseAmount),
      savingsAmount: 0,
    };
  }

  const finalAmount = calculateVipDiscount(profile, baseAmount);
  const savingsAmount = Number((baseAmount - finalAmount).toFixed(2));

  return {
    plan,
    discountPercent: activeDiscount,
    originalAmount: baseAmount,
    finalAmount,
    savingsAmount,
  };
}
