import { describe, it, expect } from "vitest";
import { getVipDiscountSummary, isVipActive, getVipPlanById } from "@/utils/vip";

describe("getVipDiscountSummary", () => {
  it("no VIP → no discount", () => {
    const result = getVipDiscountSummary(null, 100);
    expect(result.discountPercent).toBe(0);
    expect(result.finalAmount).toBe(100);
    expect(result.savingsAmount).toBe(0);
    expect(result.plan).toBeNull();
  });

  it("starter VIP 10%", () => {
    const result = getVipDiscountSummary(
      { vip_plan: "vip_starter", vip_expires_at: new Date(Date.now() + 86400000).toISOString() },
      100
    );
    expect(result.discountPercent).toBe(10);
    expect(result.finalAmount).toBe(90);
    expect(result.savingsAmount).toBe(10);
  });

  it("royal VIP 20%", () => {
    const result = getVipDiscountSummary(
      { vip_plan: "vip_royal", vip_expires_at: new Date(Date.now() + 86400000).toISOString() },
      250
    );
    expect(result.finalAmount).toBe(200);
  });

  it("expired VIP → no discount", () => {
    const result = getVipDiscountSummary(
      { vip_plan: "vip_pro", vip_expires_at: new Date(Date.now() - 86400000).toISOString() },
      100
    );
    expect(result.discountPercent).toBe(0);
    expect(result.finalAmount).toBe(100);
  });

  it("invalid amount is handled safely", () => {
    const result = getVipDiscountSummary(null, -5);
    expect(result.finalAmount).toBe(0);
  });
});

describe("isVipActive", () => {
  it("false when no plan", () => {
    expect(isVipActive(null)).toBe(false);
    expect(isVipActive({ vip_plan: null })).toBe(false);
  });

  it("true for active plan", () => {
    expect(isVipActive({ vip_plan: "vip_pro", vip_expires_at: new Date(Date.now() + 1000).toISOString() })).toBe(true);
  });

  it("false when expired", () => {
    expect(isVipActive({ vip_plan: "vip_pro", vip_expires_at: new Date(Date.now() - 1000).toISOString() })).toBe(false);
  });
});

describe("getVipPlanById", () => {
  it("returns plan", () => {
    expect(getVipPlanById("vip_royal")?.discountPercent).toBe(20);
    expect(getVipPlanById("nope")).toBeNull();
  });
});
