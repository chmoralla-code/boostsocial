import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { AdminShell } from "./AdminShell";
import { PinGate } from "./PinGate";
import { isPinSet, isUnlocked } from "@/lib/adminPin";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email || !user.email.endsWith("@boostsocial.com")) {
    redirect("/admin/login");
  }

  const [pinSet, unlocked] = await Promise.all([
    isPinSet(),
    isUnlocked(user.email),
  ]);

  if (!pinSet) {
    return <PinGate mode="setup" email={user.email} />;
  }

  if (!unlocked) {
    return <PinGate mode="unlock" email={user.email} />;
  }

  return <AdminShell email={user.email}>{children}</AdminShell>;
}
