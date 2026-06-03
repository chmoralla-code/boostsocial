import type { Metadata } from "next";
import { createClient } from "@/utils/supabase/server";
import { ClientAppHome } from "./ClientAppHome";
import { readMobileAppSettingsFromAnyDatabase } from "@/lib/mobileAppServer";

type AppService = {
  id: string;
  title: string;
  description: unknown;
  starting_price: number;
  icon_type: string;
};

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "PinoyBoosting App",
  description: "A simple mobile app view for PinoyBoosting services, orders, wallet, and tracking.",
};

async function getServices(): Promise<AppService[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("services")
      .select("id,title,description,starting_price,icon_type")
      .order("created_at", { ascending: true });

    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Failed to load client app services:", error);
    return [];
  }
}

export default async function AppPage() {
  const [services, appSettings] = await Promise.all([
    getServices(),
    readMobileAppSettingsFromAnyDatabase(),
  ]);

  return <ClientAppHome services={services} appSettings={appSettings} />;
}
