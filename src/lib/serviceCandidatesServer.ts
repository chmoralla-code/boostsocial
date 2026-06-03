import {
  SERVICE_CANDIDATES_KEY,
  mergeServiceCandidates,
} from "@/lib/serviceCandidates";
import { fallbackRead } from "@/utils/supabase/dual-db";

export async function readServiceCandidatesFromAnyDatabase() {
  const { data } = await fallbackRead<{ value: unknown }>(async (client) =>
    await client
      .from("settings")
      .select("value")
      .eq("key", SERVICE_CANDIDATES_KEY)
      .single()
  );

  return mergeServiceCandidates(data?.value);
}
