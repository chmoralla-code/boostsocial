import { describe, it, expect } from "vitest";
import {
  normalizePromoCode,
  applyPromoToPrice,
} from "@/lib/promo";

describe("normalizePromoCode", () => {
  it("uppercases and trims", () => {
    expect(normalizePromoCode(" welcome10 ")).toBe("WELCOME10");
  });

  it("allows letters, numbers, hyphens", () => {
    expect(normalizePromoCode("PROMO-2026")).toBe("PROMO-2026");
  });

  it("rejects invalid chars and wrong length", () => {
    expect(normalizePromoCode("A B")).toBeNull();
    expect(normalizePromoCode("A!B")).toBeNull();
    expect(normalizePromoCode("A")).toBeNull();
    expect(normalizePromoCode("")).toBeNull();
    expect(normalizePromoCode("X".repeat(40))).toBeNull();
  });
});

describe("applyPromoToPrice", () => {
  it("applies percent discount", () => {
    const result = applyPromoToPrice(100, { code: "P10", discountPercent: 10, discountAmount: 0, minOrderAmount: 0 });
    expect(result.finalAmount).toBe(90);
    expect(result.discountAmount).toBe(10);
  });

  it("applies fixed discount", () => {
    const result = applyPromoToPrice(100, { code: "P20", discountPercent: 0, discountAmount: 20, minOrderAmount: 0 });
    expect(result.finalAmount).toBe(80);
    expect(result.discountAmount).toBe(20);
  });

  it("stacks percent + fixed", () => {
    const result = applyPromoToPrice(200, { code: "P", discountPercent: 10, discountAmount: 5, minOrderAmount: 0 });
    expect(result.finalAmount).toBe(175);
    expect(result.discountAmount).toBe(25);
  });

  it("floors at zero", () => {
    const result = applyPromoToPrice(10, { code: "P", discountPercent: 100, discountAmount: 0, minOrderAmount: 0 });
    expect(result.finalAmount).toBe(0);
    expect(result.discountAmount).toBe(10);
  });

  it("never discounts more than the base", () => {
    const result = applyPromoToPrice(10, { code: "P", discountPercent: 0, discountAmount: 999, minOrderAmount: 0 });
    expect(result.finalAmount).toBe(0);
    expect(result.discountAmount).toBe(10);
  });
});
