import { fallbackRead, getPrimaryAdminClient } from "@/utils/supabase/dual-db";
import { CustomersList } from "./CustomersList";

interface AggregatedCustomer {
  id?: string;
  email: string;
  totalOrders: number;
  totalSpent: number;
  balance: number;
  lastActive: string;
  hasProfile: boolean;
  unreadCustomerMessages: number;
  lastMessageAt?: string;
  statuses: {
    pending: number;
    processing: number;
    completed: number;
    cancelled: number;
  };
}

type ProfileRow = { id: string; email: string | null; balance: number | string | null; is_deleted?: boolean | null };

async function loadProfiles(): Promise<ProfileRow[] | null> {
  const PAGE_SIZE = 1000;
  try {
    const primary = getPrimaryAdminClient();
    const rows: ProfileRow[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await primary
        .from("profiles")
        .select("id, email, balance, is_deleted")
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      rows.push(...((data ?? []) as ProfileRow[]));
      if (!data || data.length < PAGE_SIZE) break;
    }
    return rows;
  } catch (err) {
    console.error("Customers page: primary Supabase profile read failed, using fallback:", err);
    const { data } = await fallbackRead(async (db) => {
      return db
        .from("profiles")
        .select("id, email, balance");
    });
    return (data as ProfileRow[] | null) ?? null;
  }
}
type OrderRow = { customer_email: string | null; amount: number | string | null; status: string | null; created_at: string };
type ChatMessageRow = { customer_email: string | null; sender: string | null; is_read: boolean | null; created_at: string | null };

export default async function CustomersPage() {
  // Fetch all orders with transactional details.
  // fallbackRead reads the DigitalOcean primary first (where orders are written),
  // then falls back to the Supabase backups — matching the orders/topups pages so
  // balances, emails, and order history aren't missing on this dashboard.
  const { data: orders } = await fallbackRead(async (db) => {
    return db
      .from("orders")
      .select("customer_email, amount, status, created_at")
      .order("created_at", { ascending: false });
  });

  // Fetch all registered user profiles from the primary Supabase project: it
  // is the wallet source of truth (update-balance writes there and the
  // customer's header reads from there). DigitalOcean can be missing profiles,
  // which turned registered customers into "Guest shopper" rows with no
  // Edit Balance button. DigitalOcean/backups are only a fallback.
  const profiles = await loadProfiles();

  // Fetch live-support contacts too so chat-only customers still appear in admin.
  const { data: chatMessages, error: chatMessagesError } = await fallbackRead(async (db) => {
    return db
      .from("customer_messages")
      .select("customer_email, sender, is_read, created_at")
      .order("created_at", { ascending: false });
  });

  if (chatMessagesError) {
    console.error("Failed to load customer chat directory:", chatMessagesError);
  }

  // Aggregate in-memory group-by email
  const customersMap = new Map<string, AggregatedCustomer>();

  // 1. Populate registered profiles first
  const deletedProfileIds = new Set<string>();
  if (profiles) {
    (profiles as ProfileRow[]).forEach((p) => {
      if (!p.email) return;
      const email = p.email.trim();
      const emailLower = email.toLowerCase();
      if (emailLower === "[deleted user]" || emailLower === "deleted user") return;

      // Re-registered emails can have more than one profile row. Prefer the
      // live (not soft-deleted) row, since that is the one the customer logs
      // into; between rows of the same kind, keep the one holding the balance.
      const existing = customersMap.get(emailLower);
      if (existing) {
        const existingIsDeleted = deletedProfileIds.has(existing.id!);
        const candidateIsDeleted = !!p.is_deleted;
        const candidateHasMoreBalance = (Number(p.balance) || 0) > existing.balance;
        const candidateIsBetter = existingIsDeleted !== candidateIsDeleted
          ? !candidateIsDeleted
          : candidateHasMoreBalance;
        if (!candidateIsBetter) return;
      }
      if (p.is_deleted) deletedProfileIds.add(p.id);
      else deletedProfileIds.delete(p.id);

      customersMap.set(emailLower, {
        id: p.id,
        email: p.email,
        totalOrders: 0,
        totalSpent: 0,
        balance: Number(p.balance) || 0,
        lastActive: new Date().toISOString(),
        hasProfile: true,
        unreadCustomerMessages: 0,
        statuses: { pending: 0, processing: 0, completed: 0, cancelled: 0 },
      });
    });
  }

  // 2. Map orders to aggregate customer spent and orders
  if (orders) {
    (orders as OrderRow[]).forEach((order) => {
      if (!order.customer_email) return;
      const email = order.customer_email.trim();
      const emailLower = email.toLowerCase();
      if (emailLower === "[deleted user]" || emailLower === "deleted user") return;

      const amount = Number(order.amount) || 0;
      const status = (order.status || "Pending").toLowerCase();
      const date = order.created_at;

      if (!customersMap.has(emailLower)) {
        customersMap.set(emailLower, {
          email,
          totalOrders: 0,
          totalSpent: 0,
          balance: 0,
          lastActive: date,
          hasProfile: false,
          unreadCustomerMessages: 0,
          statuses: { pending: 0, processing: 0, completed: 0, cancelled: 0 },
        });
      }

      const cust = customersMap.get(emailLower)!;
      cust.totalOrders += 1;
      cust.totalSpent += amount;
      
      // Update last active if order is newer or if it's default value
      if (!cust.id || new Date(date) > new Date(cust.lastActive)) {
        cust.lastActive = date;
      }

      if (status === "pending") cust.statuses.pending += 1;
      else if (status === "processing") cust.statuses.processing += 1;
      else if (status === "completed") cust.statuses.completed += 1;
      else if (status === "cancelled") cust.statuses.cancelled += 1;
    });
  }

  // 3. Merge live-support message activity and unread customer replies.
  if (chatMessages) {
    (chatMessages as ChatMessageRow[]).forEach((message) => {
      if (!message.customer_email) return;

      const email = message.customer_email.trim();
      const emailLower = email.toLowerCase();
      if (emailLower === "[deleted user]" || emailLower === "deleted user") return;

      const messageDate = message.created_at || new Date().toISOString();
      if (!customersMap.has(emailLower)) {
        customersMap.set(emailLower, {
          email,
          totalOrders: 0,
          totalSpent: 0,
          balance: 0,
          lastActive: messageDate,
          hasProfile: false,
          unreadCustomerMessages: 0,
          statuses: { pending: 0, processing: 0, completed: 0, cancelled: 0 },
        });
      }

      const cust = customersMap.get(emailLower)!;
      if (!cust.lastMessageAt || new Date(messageDate) > new Date(cust.lastMessageAt)) {
        cust.lastMessageAt = messageDate;
      }
      if (new Date(messageDate) > new Date(cust.lastActive)) {
        cust.lastActive = messageDate;
      }
      if (message.sender === "customer" && !message.is_read) {
        cust.unreadCustomerMessages += 1;
      }
    });
  }

  const customersList = Array.from(customersMap.values());

  const metrics = {
    totalCustomers: customersList.length,
    registeredCount: customersList.filter(c => c.hasProfile).length,
    guestCount: customersList.filter(c => !c.hasProfile).length,
    totalSpent: customersList.reduce((acc, c) => acc + c.totalSpent, 0),
    totalCapital: customersList.reduce((acc, c) => acc + c.balance, 0),
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300 text-slate-300">
      <div className="flex justify-between items-start md:items-center gap-4 border-b border-slate-850/60 pb-6">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            Customer Directory
          </h1>
          <p className="text-xs text-slate-400 font-semibold mt-1">
            Analyze customer lifetime value, manage wallet balances, and audit purchase history.
          </p>
        </div>
      </div>
      <CustomersList initialCustomers={customersList} metrics={metrics} />
    </div>
  );
}
