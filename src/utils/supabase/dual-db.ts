import { createClient, SupabaseClient } from "@supabase/supabase-js";

type BackupLabel = "backup" | "backup3" | "backup4" | "backup5";
type DatabaseUsed = "primary" | BackupLabel | "both";

type BackupConfig = {
  label: BackupLabel;
  displayName: string;
  url?: string;
  key?: string;
};

export type BackupAdminClient = {
  label: BackupLabel;
  displayName: string;
  client: SupabaseClient;
};

const primaryUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const primaryKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const backupConfigs: BackupConfig[] = [
  {
    label: "backup",
    displayName: "Backup",
    url: process.env.BACKUP_SUPABASE_URL,
    key: process.env.BACKUP_SUPABASE_SERVICE_ROLE_KEY,
  },
  {
    label: "backup3",
    displayName: "BACKUP 3",
    url: process.env.BACKUP3_SUPABASE_URL,
    key: process.env.BACKUP3_SUPABASE_SERVICE_ROLE_KEY,
  },
  {
    label: "backup4",
    displayName: "BACKUP 4",
    url: process.env.BACKUP4_SUPABASE_URL,
    key: process.env.BACKUP4_SUPABASE_SERVICE_ROLE_KEY,
  },
  {
    label: "backup5",
    displayName: "BACKUP 5",
    url: process.env.BACKUP5_SUPABASE_URL,
    key: process.env.BACKUP5_SUPABASE_SERVICE_ROLE_KEY,
  },
];

let cachedPrimary: SupabaseClient | null = null;
const cachedBackups: Partial<Record<BackupLabel, SupabaseClient>> = {};

const createAdminClient = (url: string, key: string) =>
  createClient(url, key, {
    auth: { persistSession: false },
  });

const getBackupConfig = (label: BackupLabel) => {
  const config = backupConfigs.find((item) => item.label === label);
  if (!config) {
    throw new Error(`${label} Supabase Admin configuration is missing.`);
  }
  return config;
};

const getConfiguredBackupClient = (config: BackupConfig): BackupAdminClient => {
  if (!config.url || !config.key) {
    throw new Error(`${config.displayName} Supabase Admin configuration is missing.`);
  }

  if (!cachedBackups[config.label]) {
    cachedBackups[config.label] = createAdminClient(config.url, config.key);
  }

  return {
    label: config.label,
    displayName: config.displayName,
    client: cachedBackups[config.label]!,
  };
};

export function getPrimaryAdminClient(): SupabaseClient {
  if (!primaryUrl || !primaryKey) {
    throw new Error("Primary Supabase Admin configuration is missing.");
  }
  if (!cachedPrimary) {
    cachedPrimary = createAdminClient(primaryUrl, primaryKey);
  }
  return cachedPrimary;
}

export function getBackupAdminClient(): SupabaseClient {
  return getConfiguredBackupClient(getBackupConfig("backup")).client;
}

export function getBackup3AdminClient(): SupabaseClient {
  return getConfiguredBackupClient(getBackupConfig("backup3")).client;
}

export function getBackup4AdminClient(): SupabaseClient {
  return getConfiguredBackupClient(getBackupConfig("backup4")).client;
}

export function getBackup5AdminClient(): SupabaseClient {
  return getConfiguredBackupClient(getBackupConfig("backup5")).client;
}

export function getBackupAdminClients(): BackupAdminClient[] {
  return backupConfigs
    .filter((config) => config.url && config.key)
    .map((config) => getConfiguredBackupClient(config));
}

export async function syncBackupAdminClients(
  operation: (client: SupabaseClient, label: BackupLabel) => Promise<{ error?: any } | void>,
  context: string
) {
  const results: Array<{ label: BackupLabel; error: any | null }> = [];

  for (const backup of getBackupAdminClients()) {
    try {
      const result = await operation(backup.client, backup.label);
      const error = result && "error" in result ? result.error : null;
      if (error) {
        throw error;
      }
      results.push({ label: backup.label, error: null });
    } catch (err) {
      console.error(`${backup.displayName} DB ${context} failed:`, err);
      results.push({ label: backup.label, error: err });
    }
  }

  return results;
}

/**
 * Executes a write operation on primary and every configured backup.
 * If primary fails, the first successful backup keeps the request operational.
 */
export async function dualWrite<T = any>(
  operation: (client: SupabaseClient) => Promise<{ data: T | null; error: any }>
): Promise<{ data: T | null; error: any; databaseUsed: DatabaseUsed }> {
  const primary = getPrimaryAdminClient();
  const backups = getBackupAdminClients();

  let primaryResult: T | null = null;
  let primaryError: any = null;
  const backupResults: Array<{ label: BackupLabel; data: T | null; error: any }> = [];

  try {
    const res = await operation(primary);
    primaryResult = res.data;
    primaryError = res.error;
  } catch (err: any) {
    primaryError = err;
  }

  for (const backup of backups) {
    try {
      const res = await operation(backup.client);
      backupResults.push({ label: backup.label, data: res.data, error: res.error });
    } catch (err: any) {
      backupResults.push({ label: backup.label, data: null, error: err });
    }
  }

  if (!primaryError) {
    const allBackupsSynced = backupResults.every((result) => !result.error);
    return {
      data: primaryResult,
      error: null,
      databaseUsed: backups.length > 0 && allBackupsSynced ? "both" : "primary",
    };
  }

  console.warn("Primary database write failed. Falling back to a backup database:", primaryError.message || primaryError);

  const successfulBackup = backupResults.find((result) => !result.error);
  if (successfulBackup) {
    return {
      data: successfulBackup.data,
      error: null,
      databaseUsed: successfulBackup.label,
    };
  }

  return {
    data: null,
    error: primaryError || backupResults[0]?.error,
    databaseUsed: "primary",
  };
}

/**
 * Executes a read operation against primary first, then each configured backup.
 */
export async function fallbackRead<T = any>(
  operation: (client: SupabaseClient) => Promise<{ data: T | null; error: any }>
): Promise<{ data: T | null; error: any; databaseUsed: "primary" | BackupLabel }> {
  const primary = getPrimaryAdminClient();

  try {
    const res = await operation(primary);
    if (!res.error) {
      return { data: res.data, error: null, databaseUsed: "primary" };
    }
    console.warn("Primary database read failed. Querying backup databases...");
  } catch (err) {
    console.warn("Primary database read network exception. Querying backup databases...", err);
  }

  for (const backup of getBackupAdminClients()) {
    try {
      const res = await operation(backup.client);
      if (!res.error) {
        return {
          data: res.data,
          error: null,
          databaseUsed: backup.label,
        };
      }
    } catch {
      // Continue to the next configured backup.
    }
  }

  return {
    data: null,
    error: new Error("Primary and backup databases failed."),
    databaseUsed: "backup",
  };
}
