import { NextRequest, NextResponse } from "next/server";
import { getPrimaryAdminClient, syncBackupAdminClients } from "@/utils/supabase/dual-db";

const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

export async function POST(req: NextRequest) {
  try {
    const { orderId } = await req.json();
    const cleanOrderId = typeof orderId === "string" ? orderId.trim() : "";

    if (!cleanOrderId) {
      return NextResponse.json({ error: "Missing order ID." }, { status: 400 });
    }

    const supabase = getPrimaryAdminClient();
    const { error: deleteError } = await supabase
      .from("orders")
      .delete()
      .eq("id", cleanOrderId);

    if (deleteError) {
      throw deleteError;
    }

    await syncBackupAdminClients(async (backupClient) => {
      return backupClient
        .from("orders")
        .delete()
        .eq("id", cleanOrderId);
    }, "delete order sync");

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("Delete order endpoint failed:", err);
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
