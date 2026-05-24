import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

export async function GET() {
  let primarySql: any = null;
  let backupSql: any = null;

  try {
    const primaryUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const primaryKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const primaryDbUrl = process.env.DATABASE_URL;

    const backupUrl = process.env.BACKUP_SUPABASE_URL;
    const backupKey = process.env.BACKUP_SUPABASE_SERVICE_ROLE_KEY;
    const backupDbUrl = process.env.BACKUP_DATABASE_URL;

    if (!primaryUrl || !primaryKey) {
      return NextResponse.json({ error: "Primary server credentials missing" }, { status: 500 });
    }

    const primaryClient = createClient(primaryUrl, primaryKey, {
      auth: { persistSession: false }
    });

    // ─────────────────────────────────────────────────────────
    // 1. PRIMARY METRICS
    // ─────────────────────────────────────────────────────────
    let primarySizeBytes = 0;
    let primaryFilesCount = 0;
    
    try {
      const { data: buckets } = await primaryClient.storage.listBuckets();
      if (buckets) {
        for (const bucket of buckets) {
          const { data: files } = await primaryClient.storage.from(bucket.id).list();
          if (files) {
            files.forEach(file => {
              if (file.metadata && file.metadata.size) {
                primarySizeBytes += file.metadata.size;
              }
              primaryFilesCount++;
            });
          }
        }
      }
    } catch (err) {
      console.error("Failed primary storage fetch:", err);
    }

    let primaryDbSizeMB = 0.05;
    let primaryUsers = 0;

    if (primaryDbUrl) {
      try {
        primarySql = postgres(primaryDbUrl, { ssl: 'require' });
        const sizeRes = await primarySql`SELECT pg_database_size(current_database()) / 1024.0 / 1024.0 AS size_mb;`;
        if (sizeRes?.[0]) primaryDbSizeMB = parseFloat(sizeRes[0].size_mb) || 0.05;

        const usersRes = await primarySql`SELECT count(*)::integer AS user_count FROM auth.users;`;
        if (usersRes?.[0]) primaryUsers = usersRes[0].user_count || 0;
      } catch (err) {
        console.error("Failed primary direct postgres, trying client:", err);
        const { count } = await primaryClient.from('profiles').select('*', { count: 'exact', head: true });
        primaryUsers = count || 0;
      }
    }

    const primaryStorageMB = primarySizeBytes / 1024 / 1024;
    const storageLimitMB = 1024; // 1GB
    const primaryDbLimitMB = 500; // 500MB

    // ─────────────────────────────────────────────────────────
    // 2. BACKUP METRICS (Tokyo Secondary)
    // ─────────────────────────────────────────────────────────
    let backupSizeBytes = 0;
    let backupFilesCount = 0;
    let backupDbSizeMB = 0.05;
    let backupUsers = 0;
    let backupActive = false;

    if (backupUrl && backupKey) {
      try {
        const backupClient = createClient(backupUrl, backupKey, {
          auth: { persistSession: false }
        });

        const { data: buckets } = await backupClient.storage.listBuckets();
        if (buckets) {
          backupActive = true;
          for (const bucket of buckets) {
            const { data: files } = await backupClient.storage.from(bucket.id).list();
            if (files) {
              files.forEach(file => {
                if (file.metadata && file.metadata.size) {
                  backupSizeBytes += file.metadata.size;
                }
                backupFilesCount++;
              });
            }
          }
        }
      } catch (err) {
        console.error("Failed backup storage fetch:", err);
      }

      if (backupDbUrl) {
        try {
          backupSql = postgres(backupDbUrl, { ssl: 'require' });
          const sizeRes = await backupSql`SELECT pg_database_size(current_database()) / 1024.0 / 1024.0 AS size_mb;`;
          if (sizeRes?.[0]) backupDbSizeMB = parseFloat(sizeRes[0].size_mb) || 0.05;

          const usersRes = await backupSql`SELECT count(*)::integer AS user_count FROM auth.users;`;
          if (usersRes?.[0]) backupUsers = usersRes[0].user_count || 0;
        } catch (err) {
          console.error("Failed backup direct postgres:", err);
        }
      }
    }

    const backupStorageMB = backupSizeBytes / 1024 / 1024;

    return NextResponse.json({
      success: true,
      // Primary Data
      totalFiles: primaryFilesCount,
      usedMB: primaryStorageMB.toFixed(2),
      remainingMB: (storageLimitMB - primaryStorageMB).toFixed(2),
      percentage: ((primaryStorageMB / storageLimitMB) * 100).toFixed(2),
      totalUsers: primaryUsers,
      dbSizeMB: primaryDbSizeMB.toFixed(2),
      dbRemainingMB: (primaryDbLimitMB - primaryDbSizeMB).toFixed(2),
      dbPercentage: ((primaryDbSizeMB / primaryDbLimitMB) * 100).toFixed(2),

      // Backup Data (Tokyo Secondary)
      backup: {
        active: backupActive,
        totalFiles: backupFilesCount,
        usedMB: backupStorageMB.toFixed(2),
        remainingMB: (storageLimitMB - backupStorageMB).toFixed(2),
        percentage: ((backupStorageMB / storageLimitMB) * 100).toFixed(2),
        totalUsers: backupUsers,
        dbSizeMB: backupDbSizeMB.toFixed(2),
        dbRemainingMB: (primaryDbLimitMB - backupDbSizeMB).toFixed(2),
        dbPercentage: ((backupDbSizeMB / primaryDbLimitMB) * 100).toFixed(2),
      }
    });

  } catch (err: any) {
    console.error("Storage stats API failed:", err);
    return NextResponse.json({ error: err.message || err.toString() }, { status: 500 });
  } finally {
    if (primarySql) await primarySql.end();
    if (backupSql) await backupSql.end();
  }
}
