import { describe, it, expect } from "vitest";
import { getFBReactionsSMMDetails, getFBReactionRetailPrice, FB_REACTIONS_MAP } from "@/utils/fbReactions";

describe("getFBReactionsSMMDetails", () => {
  it("single Like maps to its live provider id", () => {
    const details = getFBReactionsSMMDetails(["Like"]);
    expect(details.smmId).toBe(FB_REACTIONS_MAP["Like"].smmId);
    expect(details.isMixed).toBe(false);
  });

  it("maps every reaction type to its own distinct provider id", () => {
    const ids = Object.keys(FB_REACTIONS_MAP).map((name) => {
      const details = getFBReactionsSMMDetails([name]);
      expect(details.smmId).toBe(FB_REACTIONS_MAP[name].smmId);
      expect(details.isMixed).toBe(false);
      return details.smmId;
    });
    expect(new Set(ids).size).toBe(Object.keys(FB_REACTIONS_MAP).length);
  });

  it("single non-like maps to its own id", () => {
    expect(getFBReactionsSMMDetails(["Love"]).smmId).toBe(FB_REACTIONS_MAP["Love"].smmId);
  });

  it("empty selection falls back to Like", () => {
    expect(getFBReactionsSMMDetails([]).smmId).toBe(FB_REACTIONS_MAP["Like"].smmId);
  });

  it("ignores blank entries in the selection", () => {
    expect(getFBReactionsSMMDetails([""]).smmId).toBe(FB_REACTIONS_MAP["Like"].smmId);
  });

  it("mixed selections are flagged instead of guessing an id", () => {
    // RixeySMM has no Facebook mixed-reaction service, so there is no valid id.
    const details = getFBReactionsSMMDetails(["Like", "Love"]);
    expect(details.isMixed).toBe(true);
    expect(details.smmId).toBeNull();
  });

  it("a full mix is still reported as mixed", () => {
    const details = getFBReactionsSMMDetails(Object.keys(FB_REACTIONS_MAP));
    expect(details.isMixed).toBe(true);
    expect(details.smmId).toBeNull();
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

  it("prices a mixed selection at the highest selected rate", () => {
    const price = getFBReactionRetailPrice(["Like", "Angry"]);
    const highest = Math.max(FB_REACTIONS_MAP["Like"].rate, FB_REACTIONS_MAP["Angry"].rate);
    expect(price).toBeCloseTo((highest / 1000) * 3, 4);
  });
});
