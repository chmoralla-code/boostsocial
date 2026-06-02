import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { AdminShell } from "./AdminShell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !user.email?.endsWith("@boostsocial.com")) {
    redirect("/admin/login");
  }

  return <AdminShell>{children}</AdminShell>;
}
