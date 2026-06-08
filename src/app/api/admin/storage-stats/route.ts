import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

const STORAGE_LIMIT_MB = 1024; // 1 GB
const DB_LIMIT_MB = 500; // 500 MB

type SqlClient = ReturnType<typeof postgres>;

type Metrics = {
  active: boolean;
  totalFiles: number;
  usedMB: string;
  remainingMB: string;
  percentage: string;
  totalUsers: number;
  dbSizeMB: string;
  dbRemainingMB: string;
  dbPercentage: string;
};

function toMetrics(sizeBytes: number, filesCount: number, users: number, dbSizeMB: number, active: boolean): Metrics {
  const storageMB = sizeBytes / 1024 / 1024;
  return {
    active,
    totalFiles: filesCount,
    usedMB: storageMB.toFixed(2),
    remainingMB: Math.max(STORAGE_LIMIT_MB - storageMB, 0).toFixed(2),
    percentage: ((storageMB / STORAGE_LIMIT_MB) * 100).toFixed(2),
    totalUsers: users,
    dbSizeMB: dbSizeMB.toFixed(2),
    dbRemainingMB: Math.max(DB_LIMIT_MB - dbSizeMB, 0).toFixed(2),
    dbPercentage: ((dbSizeMB / DB_LIMIT_MB) * 100).toFixed(2),
  };
}

async function collectProjectMetrics(
  options: {
    url?: string;
    key?: string;
    dbUrl?: string;
    sqlClients: SqlClient[];
    requireCredentials?: boolean;
  }
): Promise<Metrics> {
  const { url, key, dbUrl, sqlClients, requireCredentials } = options;

  if (!url || !key) {
    if (requireCredentials) {
      throw new Error("Primary server credentials missing");
    }
    return toMetrics(0, 0, 0, 0.05, false);
  }

  const client = createClient(url, key, {
    auth: { persistSession: false },
  });

  let sizeBytes = 0;
  let filesCount = 0;
  let users = 0;
  let dbSizeMB = 0.05;
  let active = false;

  try {
    const { data: buckets } = await client.storage.listBuckets();
    if (buckets) {
      active = true;
      for (const bucket of buckets) {
        const { data: files } = await client.storage.from(bucket.id).list();
        if (files) {
          for (const file of files) {
            if (file.metadata && file.metadata.size) {
              sizeBytes += file.metadata.size;
            }
            filesCount++;
          }
        }
      }
    }
  } catch (err) {
    console.error("Failed storage fetch:", err);
  }

  if (dbUrl) {
    try {
      const sql = postgres(dbUrl, { ssl: "require" });
      sqlClients.push(sql);

      const sizeRes = await sql`SELECT pg_database_size(current_database()) / 1024.0 / 1024.0 AS size_mb;`;
      if (sizeRes?.[0]) {
        dbSizeMB = parseFloat(sizeRes[0].size_mb) || 0.05;
      }

      const usersRes = await sql`SELECT count(*)::integer AS user_count FROM auth.users;`;
      if (usersRes?.[0]) {
        users = usersRes[0].user_count || 0;
      }
      active = true;
    } catch (err) {
      console.error("Failed direct postgres metrics fetch:", err);
      try {
        const { count, error } = await client.from("profiles").select("*", { count: "exact", head: true });
        if (!error) {
          users = count || 0;
          active = true;
        }
      } catch (err2) {
        console.error("Failed fallback REST profiles fetch:", err2);
      }
    }
  } else {
    try {
      const { count, error } = await client.from("profiles").select("*", { count: "exact", head: true });
      if (!error) {
        users = count || 0;
        active = true;
      }
    } catch (err) {
      console.error("Failed REST profiles fetch:", err);
    }
  }

  return toMetrics(sizeBytes, filesCount, users, dbSizeMB, active);
}

export async function GET() {
  const sqlClients: SqlClient[] = [];

  try {
    const primaryMetrics = await collectProjectMetrics({
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      key: process.env.SUPABASE_SERVICE_ROLE_KEY,
      dbUrl: process.env.DATABASE_URL,
      sqlClients,
      requireCredentials: true,
    });

    const backupMetrics = await collectProjectMetrics({
      url: process.env.BACKUP_SUPABASE_URL,
      key: process.env.BACKUP_SUPABASE_SERVICE_ROLE_KEY,
      dbUrl: process.env.BACKUP_DATABASE_URL,
      sqlClients,
    });

    const backup3Metrics = await collectProjectMetrics({
      url: process.env.BACKUP3_SUPABASE_URL,
      key: process.env.BACKUP3_SUPABASE_SERVICE_ROLE_KEY,
      dbUrl: process.env.BACKUP3_DATABASE_URL,
      sqlClients,
    });

    const backup4Metrics = await collectProjectMetrics({
      url: process.env.BACKUP4_SUPABASE_URL,
      key: process.env.BACKUP4_SUPABASE_SERVICE_ROLE_KEY,
      dbUrl: process.env.BACKUP4_DATABASE_URL,
      sqlClients,
    });

    const backup5Metrics = await collectProjectMetrics({
      url: process.env.BACKUP5_SUPABASE_URL,
      key: process.env.BACKUP5_SUPABASE_SERVICE_ROLE_KEY,
      dbUrl: process.env.BACKUP5_DATABASE_URL,
      sqlClients,
    });

    return NextResponse.json({
      success: true,
      totalFiles: primaryMetrics.totalFiles,
      usedMB: primaryMetrics.usedMB,
      remainingMB: primaryMetrics.remainingMB,
      percentage: primaryMetrics.percentage,
      totalUsers: primaryMetrics.totalUsers,
      dbSizeMB: primaryMetrics.dbSizeMB,
      dbRemainingMB: primaryMetrics.dbRemainingMB,
      dbPercentage: primaryMetrics.dbPercentage,
      backup: backupMetrics,
      backup3: backup3Metrics,
      backup4: backup4Metrics,
      backup5: backup5Metrics,
    });
  } catch (err: any) {
    console.error("Storage stats API failed:", err);
    return NextResponse.json({ error: err.message || err.toString() }, { status: 500 });
  } finally {
    for (const sql of sqlClients) {
      await sql.end();
    }
  }
}
