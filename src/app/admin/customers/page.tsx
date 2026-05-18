import { createClient } from "@/utils/supabase/server";
import { CustomersList } from "./CustomersList";

interface AggregatedCustomer {
  email: string;
  totalOrders: number;
  totalSpent: number;
  lastActive: string;
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

  // Aggregate in-memory group-by email
  const customersMap = new Map<string, AggregatedCustomer>();

  if (orders) {
    orders.forEach((order) => {
      const email = order.customer_email.trim();
      if (email === "[Deleted User]") return; // Skip deleted users from the customer list

      const amount = Number(order.amount) || 0;
      const status = (order.status || "Pending").toLowerCase();
      const date = order.created_at;

      if (!customersMap.has(email)) {
        customersMap.set(email, {
          email,
          totalOrders: 0,
          totalSpent: 0,
          lastActive: date,
          statuses: { pending: 0, processing: 0, completed: 0, cancelled: 0 },
        });
      }

      const cust = customersMap.get(email)!;
      cust.totalOrders += 1;
      cust.totalSpent += amount;
      
      // Since orders are pre-sorted descending, the first one seen is the most recent
      if (new Date(date) > new Date(cust.lastActive)) {
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
