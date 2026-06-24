import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { enforceRateLimit } from "@/utils/security/rate-limit";
import { isAdminEmail } from "@/utils/security/admin";
import { compressReceiptImage, bufferToDataUrl } from "@/utils/serverImageCompressor";

const MAX_ASSET_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_ASSET_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const ALLOWED_ASSET_KEYS = new Set(["profile", "cover"]);

export async function POST(req: NextRequest) {
  try {
    const rateLimitResponse = enforceRateLimit(req, {
      key: "upload-page-asset",
      maxRequests: 30,
      windowMs: 10 * 60_000,
    });
    if (rateLimitResponse) return rateLimitResponse;

    const sessionClient = await createServerClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();
    if (!user?.email) {
      return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const orderId = formData.get("orderId") as string | null;
    const assetType = formData.get("assetType") as string | null; // "profile" or "cover"

    if (!file || !orderId || !assetType) {
      return NextResponse.json({ error: "Missing file, orderId, or assetType" }, { status: 400 });
    }

    if (!ALLOWED_ASSET_KEYS.has(assetType)) {
      return NextResponse.json({ error: "Invalid asset type." }, { status: 400 });
    }

    if (!ALLOWED_ASSET_TYPES.has(file.type.toLowerCase())) {
      return NextResponse.json({ error: "Invalid image file type." }, { status: 400 });
    }

    if (file.size <= 0 || file.size > MAX_ASSET_FILE_BYTES) {
      return NextResponse.json({ error: "Image is too large. Maximum is 10MB." }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Supabase environment variables missing on server!");
      return NextResponse.json({ error: "Server configuration missing" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

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
      return NextResponse.json({ error: "You can only upload assets for your own order." }, { status: 403 });
    }

    // Server-side compression: keeps order profile/cover assets compact in the
    // receipts bucket regardless of client behavior.
    const compressed = await compressReceiptImage(file);

    const fileName = `${orderId}_${assetType}.${compressed.extension}`;

    let publicUrl = "";
    try {
      const { error } = await supabase.storage
        .from('receipts')
        .upload(fileName, compressed.buffer, {
          upsert: true,
          contentType: compressed.mimeType,
        });

      if (error) throw error;

      publicUrl = `${supabaseUrl}/storage/v1/object/public/receipts/${fileName}`;
      await supabase
        .from("order_assets")
        .upsert({
          order_id: orderId,
          asset_type: assetType,
          content_type: compressed.mimeType,
          storage_url: publicUrl,
          data_url: null,
          updated_at: new Date().toISOString(),
        }, { onConflict: "order_id,asset_type" });
    } catch (storageError) {
      console.warn(`Storage upload for ${assetType} asset failed; using DB fallback:`, storageError);
      const dataUrl = bufferToDataUrl(compressed.buffer, compressed.mimeType);
      const { error: assetError } = await supabase
        .from("order_assets")
        .upsert({
          order_id: orderId,
          asset_type: assetType,
          content_type: compressed.mimeType,
          data_url: dataUrl,
          storage_url: null,
          updated_at: new Date().toISOString(),
        }, { onConflict: "order_id,asset_type" });

      if (assetError) throw assetError;
      publicUrl = `${req.nextUrl.origin}/api/order-assets/${encodeURIComponent(orderId)}/${encodeURIComponent(assetType)}`;
    }

    return NextResponse.json({ success: true, url: publicUrl });
  } catch (err: any) {
    console.error("Asset upload failed:", err);
    return NextResponse.json({ error: err.message || err.toString() }, { status: 500 });
  }
}
