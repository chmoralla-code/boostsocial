import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Server credentials missing" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    const { data: files, error: listError } = await supabase.storage.from('receipts').list();
    if (listError) throw listError;

    let totalSizeBytes = 0;
    if (files) {
      files.forEach(file => {
        if (file.metadata && file.metadata.size) {
          totalSizeBytes += file.metadata.size;
        }
      });
    }

    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    const totalSizeMB = (totalSizeBytes / 1024 / 1024);
    const limitMB = 1024; // 1GB
    const percentage = ((totalSizeMB / limitMB) * 100).toFixed(2);
    
    return NextResponse.json({
      success: true,
      totalFiles: files?.length || 0,
      usedMB: totalSizeMB.toFixed(2),
      remainingMB: (limitMB - totalSizeMB).toFixed(2),
      percentage,
      totalUsers: totalUsers || 0
    });
  } catch (err: any) {
    console.error("Storage stats fetch failed:", err);
    return NextResponse.json({ error: err.message || err.toString() }, { status: 500 });
  }
}
