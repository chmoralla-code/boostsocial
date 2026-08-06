import { describe, it, expect } from "vitest";
import { getFBReactionsSMMDetails, getFBReactionRetailPrice, FB_REACTIONS_MAP } from "@/utils/fbReactions";

describe("getFBReactionsSMMDetails", () => {
  it("single Like maps to its cheap id", () => {
    const details = getFBReactionsSMMDetails(["Like"]);
    expect(details.smmId).toBe(FB_REACTIONS_MAP["Like"].smmId);
  });

  it("single non-like maps to its id", () => {
    expect(getFBReactionsSMMDetails(["Love"]).smmId).toBe(3021);
  });

  it("empty selection falls back to Like", () => {
    expect(getFBReactionsSMMDetails([]).smmId).toBe(FB_REACTIONS_MAP["Like"].smmId);
  });

  it("Like+Love maps to mixed package 1961", () => {
    expect(getFBReactionsSMMDetails(["Like", "Love"]).smmId).toBe(1961);
  });

  it("full 5-mix maps to 1964", () => {
    expect(getFBReactionsSMMDetails(["Like", "Love", "Care", "Haha", "Wow"]).smmId).toBe(1964);
  });

  it("unknown complex mix falls back to 1965", () => {
    expect(getFBReactionsSMMDetails(["Like", "Sad", "Angry"]).smmId).toBe(1965);
  });
});

describe("getFBReactionRetailPrice", () => {
  it("applies 3x markup default", () => {
    const price = getFBReactionRetailPrice(["Like"]);
    expect(price).toBeCloseTo((FB_REACTIONS_MAP["Like"].rate / 1000) * 3, 4);
  });

  it("applies custom markup", () => {
    const price = getFBReactionRetailPrice(["Like"], 2.0);
    expect(price).toBeCloseTo((FB_REACTIONS_MAP["Like"].rate / 1000) * 2, 4);
  });
});
