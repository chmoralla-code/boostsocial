import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { isAdminEmail } from "@/utils/security/admin";

const ALLOWED_ASSET_KEYS = new Set(["profile", "cover"]);

type RouteContext = {
  params: Promise<{
    orderId: string;
    assetType: string;
  }>;
};

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Server configuration missing");
  }

  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
}

function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return {
    contentType: match[1],
    buffer: Buffer.from(match[2], "base64"),
  };
}

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { orderId, assetType } = await context.params;
    if (!orderId || !ALLOWED_ASSET_KEYS.has(assetType)) {
      return NextResponse.json({ error: "Invalid asset request." }, { status: 400 });
    }

    const sessionClient = await createServerClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();
    if (!user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabase();
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("customer_email")
      .eq("id", orderId)
      .maybeSingle();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    const requesterEmail = user.email.trim().toLowerCase();
    const orderEmail = String(order.customer_email || "").trim().toLowerCase();
    if (!isAdminEmail(requesterEmail) && requesterEmail !== orderEmail) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: asset, error: assetError } = await supabase
      .from("order_assets")
      .select("content_type, data_url, storage_url")
      .eq("order_id", orderId)
      .eq("asset_type", assetType)
      .maybeSingle();

    if (assetError || !asset) {
      return NextResponse.json({ error: "Asset not found." }, { status: 404 });
    }

    if (asset.storage_url && !asset.data_url) {
      return NextResponse.redirect(asset.storage_url);
    }

    const parsed = parseDataUrl(asset.data_url || "");
    if (!parsed) {
      return NextResponse.json({ error: "Asset data is invalid." }, { status: 500 });
    }

    return new NextResponse(parsed.buffer, {
      headers: {
        "Content-Type": asset.content_type || parsed.contentType,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    console.error("Order asset read failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
