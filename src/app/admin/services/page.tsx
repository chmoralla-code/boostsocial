import { createClient } from "@/utils/supabase/server";
import { ServicesTable } from "./ServicesTable";

export default async function ServicesPage() {
  const supabase = await createClient();

  const { data: services } = await supabase
    .from('services')
    .select('*')
    .order('created_at', { ascending: true });

  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-900 mb-8">Service Management</h1>
      <ServicesTable initialServices={services || []} />
    </div>
  );
}
