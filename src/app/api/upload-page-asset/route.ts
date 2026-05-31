import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { enforceRateLimit } from "@/utils/security/rate-limit";
import { isAdminEmail } from "@/utils/security/admin";

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

    const fileExt = file.name.split('.').pop() || 'png';
    const fileName = `${orderId}_${assetType}.${fileExt}`;

    // Upload to 'receipts' bucket which is already pre-configured to allow uploads
    const { error } = await supabase.storage
      .from('receipts')
      .upload(fileName, file, {
        upsert: true
      });

    if (error) {
      throw error;
    }

    // Generate public URL
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/receipts/${fileName}`;

    return NextResponse.json({ success: true, url: publicUrl });
  } catch (err: any) {
    console.error("Asset upload failed:", err);
    return NextResponse.json({ error: err.message || err.toString() }, { status: 500 });
  }
}
