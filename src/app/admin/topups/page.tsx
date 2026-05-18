import { createClient } from "@/utils/supabase/server";
import { TopupsList } from "./TopupsList";

export const revalidate = 0; // Disable static caching so admin always sees fresh data

export default async function TopupsPage() {
  const supabase = await createClient();

  const { data: topups } = await supabase
    .from("topups")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-900 mb-8">Wallet Top-Ups</h1>
      <TopupsList initialTopups={topups || []} />
    </div>
  );
}
