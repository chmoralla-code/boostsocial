import { describe, expect, it } from "vitest";
import { repairMojibake, repairMojibakeDeep } from "./mojibake";

describe("repairMojibake", () => {
  it("repairs the peso sign", () => {
    expect(repairMojibake("â‚±2,301.54")).toBe("₱2,301.54");
  });

  it("repairs dashes, quotes and emoji", () => {
    expect(repairMojibake("Fast â€“ â€œrealâ€\u009d likes ðŸš€")).toBe("Fast – “real” likes 🚀");
  });

  it("repairs double-encoded text", () => {
    expect(repairMojibake("Ã¢â€šÂ±50")).toBe("₱50");
  });

  it("leaves correct text alone", () => {
    for (const text of ["₱50 – 🚀", "Café Niño señor", "100% real", "Âge? no: plain"]) {
      expect(repairMojibake(text)).toBe(text);
    }
  });

  it("repairs strings nested in objects and arrays", () => {
    expect(repairMojibakeDeep({ title: "â‚±5", tags: ["â€“"], price: 5, empty: null })).toEqual({
      title: "₱5",
      tags: ["–"],
      price: 5,
      empty: null,
    });
  });
});
