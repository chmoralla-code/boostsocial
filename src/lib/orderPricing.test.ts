import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveOrderPricing } from "@/lib/orderPricing";

// Mock the smmCatalog dependency so tests stay network-free.
vi.mock("@/lib/smmCatalog", () => ({
  getSmmCatalogServiceById: vi.fn(async () => null),
}));

import { getSmmCatalogServiceById } from "@/lib/smmCatalog";

const CATALOG_SERVICE_ID = "e6f61249-71fe-40df-84f3-96d03d3e8dcf";

function makeClient(serviceRow?: Record<string, unknown> | null) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: serviceRow ?? null, error: null }),
        }),
      }),
    }),
  } as unknown as Parameters<typeof resolveOrderPricing>[0]["client"];
}

beforeEach(() => {
  vi.mocked(getSmmCatalogServiceById).mockReset();
  vi.mocked(getSmmCatalogServiceById).mockResolvedValue(null as any);
});

describe("resolveOrderPricing — catalog orders via snapshot", () => {
  it("prices catalog service from snapshot, respecting min quantity + floor", async () => {
    const result = await resolveOrderPricing({
      client: makeClient(),
      serviceId: CATALOG_SERVICE_ID,
      quantity: 50,
      requestedSmmServiceId: "123",
      catalogSnapshot: { id: "123", name: "IG Followers", startingPrice: 0.03, min: 100, max: 10000 },
    });

    expect(result.quantity).toBe(100); // clamped to min
    expect(result.regularAmount).toBe(5.0); // 100 * 0.03 = 3 → floored at MIN_ORDER_AMOUNT 5
    expect(result.smmServiceId).toBe("123");
  });

  it("rejects quantity above max", async () => {
    await expect(
      resolveOrderPricing({
        client: makeClient(),
        serviceId: CATALOG_SERVICE_ID,
        quantity: 99999,
        requestedSmmServiceId: "123",
        catalogSnapshot: { id: "123", name: "X", startingPrice: 0.1, min: 1, max: 1000 },
      })
    ).rejects.toThrow(/cannot exceed/i);
  });
});

describe("resolveOrderPricing — DB services", () => {
  it("computes price_per_unit * quantity with MIN_ORDER_AMOUNT floor", async () => {
    const client = makeClient({
      id: "svc-1",
      title: "Facebook Followers",
      description: JSON.stringify({ min_quantity: 100 }),
      starting_price: 1.0,
      price_per_unit: 0.05,
      min_quantity: 100,
    });
    const result = await resolveOrderPricing({ client, serviceId: "svc-1", quantity: 100 });
    expect(result.regularAmount).toBe(5.0);
    expect(result.smmServiceId).toBeNull();
  });

  it("floors quantity at min_quantity", async () => {
    const client = makeClient({
      id: "svc-1",
      title: "TikTok Views",
      description: JSON.stringify({ min_quantity: 500 }),
      starting_price: 0.02,
      min_quantity: 500,
    });
    const result = await resolveOrderPricing({ client, serviceId: "svc-1", quantity: 10 });
    expect(result.quantity).toBe(500);
    expect(result.regularAmount).toBeCloseTo(10.0, 2);
  });

  it("single-item services use quantity 1", async () => {
    const client = makeClient({
      id: "svc-2",
      title: "PisoWiFi Professional License",
      description: "{}",
      starting_price: 8500,
    });
    const result = await resolveOrderPricing({ client, serviceId: "svc-2", quantity: 1 });
    expect(result.quantity).toBe(1);
    expect(result.regularAmount).toBe(8500);
  });

  it("rejects invalid quantity", async () => {
    await expect(
      resolveOrderPricing({ client: makeClient(), serviceId: "svc-1", quantity: 1.5 })
    ).rejects.toThrow(/invalid order quantity/i);
  });
});

describe("resolveOrderPricing — reaction services", () => {
  it("uses reaction retail pricing", async () => {
    const client = makeClient({
      id: "svc-3",
      title: "Facebook Reactions",
      description: "{}",
      starting_price: 0.02,
    });
    const result = await resolveOrderPricing({
      client,
      serviceId: "svc-3",
      quantity: 100,
      targetUrl: "Reactions: [Like] Link: https://fb.com/post",
    });
    // Like retail per piece at 3x = 4.49/1000*3 = 0.01347; 100 * = 1.347 → floor 5
    expect(result.regularAmount).toBeGreaterThanOrEqual(5);
    expect(result.smmServiceId).toBe(String(2860));
  });
});
