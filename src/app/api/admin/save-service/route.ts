import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const { id, title, description, starting_price, icon_type } = await req.json();

    if (!title || !description || starting_price === undefined || !icon_type) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Server configuration missing" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    const priceNum = Number(starting_price);
    if (isNaN(priceNum) || priceNum <= 0) {
      return NextResponse.json({ error: "Invalid price" }, { status: 400 });
    }

    if (id) {
      // Update existing service
      const { data, error } = await supabase
        .from("services")
        .update({
          title: title.trim(),
          description: description.trim(),
          starting_price: priceNum,
          icon_type,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, service: data });
    } else {
      // Insert new service
      const { data, error } = await supabase
        .from("services")
        .insert([
          {
            title: title.trim(),
            description: description.trim(),
            starting_price: priceNum,
            icon_type,
          }
        ])
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, service: data });
    }
  } catch (err: any) {
    console.error("Save service endpoint failed:", err);
    return NextResponse.json({ error: err.message || err.toString() }, { status: 500 });
  }
}
