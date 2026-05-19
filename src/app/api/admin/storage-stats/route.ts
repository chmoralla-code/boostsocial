import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

export async function GET() {
  let sqlClient: any = null;
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const databaseUrl = process.env.DATABASE_URL;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Server credentials missing" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    // 1. Fetch total storage size by iterating over all buckets
    let totalSizeBytes = 0;
    let totalFilesCount = 0;
    
    try {
      const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
      if (!bucketsError && buckets) {
        for (const bucket of buckets) {
          const { data: files, error: listError } = await supabase.storage.from(bucket.id).list();
          if (!listError && files) {
            files.forEach(file => {
              if (file.metadata && file.metadata.size) {
                totalSizeBytes += file.metadata.size;
              }
              totalFilesCount++;
            });
          }
        }
      }
    } catch (storageErr) {
      console.error("Failed to list storage buckets:", storageErr);
    }

    // 2. Fetch live Database Size and Auth Users Count from direct PostgreSQL connection
    let dbSizeMB = 0.05; // Fallback default database size in MB
    let totalUsers = 0;

    if (databaseUrl) {
      try {
        sqlClient = postgres(databaseUrl, { ssl: 'require' });
        
        // Query PostgreSQL database size (current database)
        const sizeResult = await sqlClient`
          SELECT pg_database_size(current_database()) / 1024.0 / 1024.0 AS size_mb;
        `;
        if (sizeResult && sizeResult[0]) {
          dbSizeMB = parseFloat(sizeResult[0].size_mb) || 0.05;
        }

        // Query precise auth users count
        const usersResult = await sqlClient`
          SELECT count(*)::integer AS user_count FROM auth.users;
        `;
        if (usersResult && usersResult[0]) {
          totalUsers = usersResult[0].user_count || 0;
        }
      } catch (dbErr) {
        console.error("Direct PostgreSQL queries failed, falling back to Supabase client:", dbErr);
        
        // Fallback for Users count using Supabase JS client profiles
        const { count } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true });
        totalUsers = count || 0;
      }
    } else {
      // Fallback if DATABASE_URL is not set
      const { count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });
      totalUsers = count || 0;
    }

    const totalStorageMB = (totalSizeBytes / 1024 / 1024);
    const storageLimitMB = 1024; // 1GB
    const storagePercentage = ((totalStorageMB / storageLimitMB) * 100).toFixed(2);

    const dbLimitMB = 500; // 500MB free limit
    const dbPercentage = ((dbSizeMB / dbLimitMB) * 100).toFixed(2);

    return NextResponse.json({
      success: true,
      totalFiles: totalFilesCount,
      usedMB: totalStorageMB.toFixed(2),
      remainingMB: (storageLimitMB - totalStorageMB).toFixed(2),
      percentage: storagePercentage,
      totalUsers: totalUsers,
      dbSizeMB: dbSizeMB.toFixed(2),
      dbRemainingMB: (dbLimitMB - dbSizeMB).toFixed(2),
      dbPercentage: dbPercentage
    });
  } catch (err: any) {
    console.error("Storage stats fetch failed:", err);
    return NextResponse.json({ error: err.message || err.toString() }, { status: 500 });
  } finally {
    if (sqlClient) {
      await sqlClient.end();
    }
  }
}
