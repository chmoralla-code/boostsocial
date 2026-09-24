import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Order = {
  id: string;
  status: string;
  service_id: string;
  smm_service_id: string | null;
  external_order_id: string | null;
  external_status: string | null;
  last_attempt_at: string | null;
  created_at: string;
  target_url: string;
  quantity: number;
};

const db: { orders: Order[] } = { orders: [] };

/** Tiny query builder over db.orders supporting the filters rixeysmm.ts uses. */
function query(table: string) {
  const rows = () => (table === "orders" ? db.orders : []);
  const filters: Array<(row: Order) => boolean> = [];
  let patch: Partial<Order> | null = null;
  let limitN = Infinity;

  const parseOr = (expr: string) => (row: Order) =>
    expr.split(",").some((clause) => {
      const [col, op, ...rest] = clause.split(".");
      const value = rest.join(".");
      const cell = row[col as keyof Order] as string | null;
      if (op === "is" && value === "null") return cell === null;
      if (op === "lt") return cell !== null && cell < value;
      return false;
    });

  const builder = {
    select: () => builder,
    update: (p: Partial<Order>) => ((patch = p), builder),
    eq: (col: keyof Order, v: unknown) => (filters.push((r) => r[col] === v), builder),
    is: (col: keyof Order, v: null) => (filters.push((r) => r[col] === v), builder),
    lt: (col: keyof Order, v: string) => (filters.push((r) => String(r[col]) < v), builder),
    or: (expr: string) => (filters.push(parseOr(expr)), builder),
    order: () => builder,
    limit: (n: number) => ((limitN = n), builder),
    maybeSingle: async () => ({ data: rows().find((r) => filters.every((f) => f(r))) ?? null, error: null }),
    then(resolve: (value: { data: Order[]; error: null }) => unknown) {
      const matched = rows().filter((r) => filters.every((f) => f(r))).slice(0, limitN);
      if (patch) matched.forEach((r) => Object.assign(r, patch));
      return Promise.resolve({ data: matched, error: null }).then(resolve);
    },
  };
  return builder;
}

vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ from: query }) }));
vi.mock("@/utils/supabase/dual-db", () => ({ syncBackupAdminClients: async () => {} }));
vi.mock("@/lib/orderEvents", () => ({ recordOrderEvent: async () => {} }));

import { autoPlaceRixeyOrder, retryUnplacedOrders } from "@/lib/rixeysmm";

const fetchMock = vi.fn();

function order(overrides: Partial<Order> = {}): Order {
  return {
    id: "order-1",
    status: "Processing",
    service_id: "svc-1",
    smm_service_id: "1086",
    external_order_id: null,
    external_status: null,
    last_attempt_at: null,
    created_at: new Date(Date.now() - 60 * 60_000).toISOString(),
    target_url: "https://www.instagram.com/p/abc/",
    quantity: 351,
    ...overrides,
  };
}

function providerReplies() {
  fetchMock.mockImplementation(async (_url: string, init: { body: URLSearchParams }) => {
    const action = init.body.get("action");
    const body = action === "balance" ? { balance: "500.00" } : { order: 777 };
    return { ok: true, json: async () => body };
  });
}

const placedCalls = () =>
  fetchMock.mock.calls.filter(([, init]) => (init as { body: URLSearchParams }).body.get("action") === "add");

beforeEach(() => {
  db.orders = [];
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  process.env.RIXEYSMM_API_KEY = "test-key";
});
afterEach(() => vi.unstubAllGlobals());

describe("autoPlaceRixeyOrder", () => {
  it("places a mapped order once and stores the provider id", async () => {
    db.orders = [order()];
    providerReplies();
    await autoPlaceRixeyOrder("order-1", "svc-1", db.orders[0].target_url, 351);

    expect(placedCalls()).toHaveLength(1);
    expect(db.orders[0].external_order_id).toBe("777");
  });

  it("never re-sends an order that already has a provider id", async () => {
    db.orders = [order({ external_order_id: "555" })];
    providerReplies();
    await autoPlaceRixeyOrder("order-1", "svc-1", db.orders[0].target_url, 351);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("skips when another request attempted it moments ago", async () => {
    db.orders = [order({ last_attempt_at: new Date().toISOString() })];
    providerReplies();
    await autoPlaceRixeyOrder("order-1", "svc-1", db.orders[0].target_url, 351);

    expect(placedCalls()).toHaveLength(0);
  });

  it("places only once when two approvals race", async () => {
    db.orders = [order()];
    providerReplies();
    await Promise.all([
      autoPlaceRixeyOrder("order-1", "svc-1", db.orders[0].target_url, 351),
      autoPlaceRixeyOrder("order-1", "svc-1", db.orders[0].target_url, 351),
    ]);

    expect(placedCalls()).toHaveLength(1);
  });
});

describe("retryUnplacedOrders", () => {
  it("re-sends approved orders that never reached the provider", async () => {
    db.orders = [
      order({ id: "never-sent" }),
      order({ id: "queued", external_status: "Queued: provider balance is PHP 0.00" }),
      order({ id: "already-placed", external_order_id: "900" }),
      order({ id: "still-pending", status: "Pending" }),
      order({ id: "just-approved", created_at: new Date().toISOString() }),
    ];
    providerReplies();
    const result = await retryUnplacedOrders();

    expect(result.attempted).toBe(2);
    expect(db.orders.find((o) => o.id === "never-sent")?.external_order_id).toBe("777");
    expect(db.orders.find((o) => o.id === "queued")?.external_order_id).toBe("777");
    expect(db.orders.find((o) => o.id === "still-pending")?.external_order_id).toBeNull();
  });
});
