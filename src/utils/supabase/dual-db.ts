import { createClient, SupabaseClient } from "@supabase/supabase-js";

const primaryUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const primaryKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const backupUrl = process.env.BACKUP_SUPABASE_URL;
const backupKey = process.env.BACKUP_SUPABASE_SERVICE_ROLE_KEY;

// Cache clients for efficiency
let cachedPrimary: SupabaseClient | null = null;
let cachedBackup: SupabaseClient | null = null;

export function getPrimaryAdminClient(): SupabaseClient {
  if (!primaryUrl || !primaryKey) {
    throw new Error("Primary Supabase Admin configuration is missing.");
  }
  if (!cachedPrimary) {
    cachedPrimary = createClient(primaryUrl, primaryKey, {
      auth: { persistSession: false },
    });
  }
  return cachedPrimary;
}

export function getBackupAdminClient(): SupabaseClient {
  if (!backupUrl || !backupKey) {
    throw new Error("Backup Supabase Admin configuration is missing.");
  }
  if (!cachedBackup) {
    cachedBackup = createClient(backupUrl, backupKey, {
      auth: { persistSession: false },
    });
  }
  return cachedBackup;
}

/**
 * Executes a write operation (insert/update/delete) on BOTH databases.
 * If the primary database is full, down, or fails, it writes to the backup
 * database and continues seamlessly to keep the application 100% operational!
 */
export async function dualWrite<T = any>(
  operation: (client: SupabaseClient) => Promise<{ data: T | null; error: any }>
): Promise<{ data: T | null; error: any; databaseUsed: "primary" | "backup" | "both" }> {
  const primary = getPrimaryAdminClient();
  const backup = getBackupAdminClient();

  let primaryResult: any = null;
  let primaryError: any = null;
  let backupResult: any = null;
  let backupError: any = null;

  // 1. Try Primary Write
  try {
    const res = await operation(primary);
    primaryResult = res.data;
    primaryError = res.error;
  } catch (err: any) {
    primaryError = err;
  }

  // 2. Try Backup Write (dual-write to keep them in perfect sync)
  try {
    const res = await operation(backup);
    backupResult = res.data;
    backupError = res.error;
  } catch (err: any) {
    backupError = err;
  }

  // 3. Evaluate results
  if (!primaryError) {
    return {
      data: primaryResult,
      error: null,
      databaseUsed: backupError ? "primary" : "both",
    };
  }

  // Primary failed! Check if backup succeeded
  console.warn("⚠️ Primary database write failed. Falling back to Backup Database:", primaryError.message || primaryError);

  if (!backupError) {
    return {
      data: backupResult,
      error: null,
      databaseUsed: "backup",
    };
  }

  // Both failed
  return {
    data: null,
    error: primaryError || backupError,
    databaseUsed: "primary", // fallback indicator
  };
}

/**
 * Executes a read operation. Attempts to read from the primary database first.
 * If the primary database is down or fails, it seamlessly reads from the backup!
 */
export async function fallbackRead<T = any>(
  operation: (client: SupabaseClient) => Promise<{ data: T | null; error: any }>
): Promise<{ data: T | null; error: any; databaseUsed: "primary" | "backup" }> {
  const primary = getPrimaryAdminClient();

  try {
    const res = await operation(primary);
    if (!res.error) {
      return { data: res.data, error: null, databaseUsed: "primary" };
    }
    // Primary error, trigger fallback
    console.warn("⚠️ Primary database read failed. Querying Backup Database...");
  } catch (err) {
    console.warn("⚠️ Primary database read network exception. Querying Backup Database...", err);
  }

  // Fallback to backup
  try {
    const backup = getBackupAdminClient();
    const res = await operation(backup);
    return {
      data: res.data,
      error: res.error,
      databaseUsed: "backup",
    };
  } catch (err: any) {
    return {
      data: null,
      error: err,
      databaseUsed: "backup",
    };
  }
}
