import { createClient } from "@/utils/supabase/server";
import { CustomersList } from "./CustomersList";

interface AggregatedCustomer {
  id?: string;
  email: string;
  totalOrders: number;
  totalSpent: number;
  balance: number;
  lastActive: string;
  hasProfile: boolean;
  statuses: {
    pending: number;
    processing: number;
    completed: number;
    cancelled: number;
  };
}

export default async function CustomersPage() {
  const supabase = await createClient();

  // Fetch all orders with transactional details
  const { data: orders } = await supabase
    .from("orders")
    .select("customer_email, amount, status, created_at")
    .order("created_at", { ascending: false });

  // Fetch all registered user profiles
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, balance");

  // Aggregate in-memory group-by email
  const customersMap = new Map<string, AggregatedCustomer>();

  // 1. Populate registered profiles first
  if (profiles) {
    profiles.forEach((p) => {
      if (!p.email) return;
      const email = p.email.trim();
      const emailLower = email.toLowerCase();
      if (emailLower === "[deleted user]" || emailLower === "deleted user") return;

      customersMap.set(emailLower, {
        id: p.id,
        email: p.email,
        totalOrders: 0,
        totalSpent: 0,
        balance: Number(p.balance) || 0,
        lastActive: new Date().toISOString(),
        hasProfile: true,
        statuses: { pending: 0, processing: 0, completed: 0, cancelled: 0 },
      });
    });
  }

  // 2. Map orders to aggregate customer spent and orders
  if (orders) {
    orders.forEach((order) => {
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

  const customersList = Array.from(customersMap.values());

  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-900 mb-8">Customer Management</h1>
      <CustomersList initialCustomers={customersList} />
    </div>
  );
}
