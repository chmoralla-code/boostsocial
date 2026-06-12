import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getEnv, getDigitalOceanDatabaseUrl } from "@/utils/env";
import postgres from "postgres";

type BackupLabel = "primary_supabase" | "backup" | "backup3" | "backup4" | "backup5";
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

const primaryUrl = getEnv("NEXT_PUBLIC_SUPABASE_URL");
const primaryKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");

const backupConfigs: BackupConfig[] = [
  {
    label: "primary_supabase",
    displayName: "Primary Supabase",
    url: primaryUrl,
    key: primaryKey,
  },
  {
    label: "backup",
    displayName: "Backup",
    url: getEnv("BACKUP_SUPABASE_URL"),
    key: getEnv("BACKUP_SUPABASE_SERVICE_ROLE_KEY"),
  },
  {
    label: "backup3",
    displayName: "BACKUP 3",
    url: getEnv("BACKUP3_SUPABASE_URL"),
    key: getEnv("BACKUP3_SUPABASE_SERVICE_ROLE_KEY"),
  },
  {
    label: "backup4",
    displayName: "BACKUP 4",
    url: getEnv("BACKUP4_SUPABASE_URL"),
    key: getEnv("BACKUP4_SUPABASE_SERVICE_ROLE_KEY"),
  },
  {
    label: "backup5",
    displayName: "BACKUP 5",
    url: getEnv("BACKUP5_SUPABASE_URL"),
    key: getEnv("BACKUP5_SUPABASE_SERVICE_ROLE_KEY"),
  },
];

let cachedPrimary: SupabaseClient | null = null;
const cachedBackups: Partial<Record<BackupLabel, SupabaseClient>> = {};
let sqlDo: ReturnType<typeof postgres> | null = null;

// Initialize DigitalOcean PostgreSQL pooler
export function getDigitalOceanSql() {
  if (!sqlDo) {
    try {
      const dbUrl = getDigitalOceanDatabaseUrl();
      // Clean connection pooler URL if transaction mode
      const cleanUrl = dbUrl.replace("?pgbouncer=true", "");
      sqlDo = postgres(cleanUrl, { ssl: "require" });
    } catch (err) {
      console.error("Failed to initialize DigitalOcean PG connection pool:", err);
    }
  }
  return sqlDo;
}

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

// ══════════════════════════════════════════════════════
//  SPY QUERY BUILDER (SUPABASE JS TO SQL TRANSLATOR)
// ══════════════════════════════════════════════════════

class SpyQueryBuilder {
  private table: string;
  private realSupabaseClient: SupabaseClient | null;
  private sqlDo: ReturnType<typeof postgres> | null;
  private action: "select" | "insert" | "update" | "upsert" | "delete";
  private columns: string;
  private filters: Array<{ column: string; operator: string; value: any }>;
  private payload: any;
  private orderByCol: string | null;
  private orderByDesc: boolean;
  private limitVal: number | null;
  private isSingle: boolean;

  constructor(
    table: string,
    realSupabaseClient: SupabaseClient | null,
    sqlDo: ReturnType<typeof postgres> | null
  ) {
    this.table = table;
    this.realSupabaseClient = realSupabaseClient;
    this.sqlDo = sqlDo;
    this.action = "select";
    this.columns = "*";
    this.filters = [];
    this.payload = null;
    this.orderByCol = null;
    this.orderByDesc = false;
    this.limitVal = null;
    this.isSingle = false;
  }

  select(columns: string = "*") {
    this.columns = columns;
    if (this.action !== "insert" && this.action !== "update" && this.action !== "upsert" && this.action !== "delete") {
      this.action = "select";
    }
    return this;
  }

  insert(payload: any) {
    this.action = "insert";
    this.payload = Array.isArray(payload) ? payload : [payload];
    return this;
  }

  update(payload: any) {
    this.action = "update";
    this.payload = payload;
    return this;
  }

  upsert(payload: any) {
    this.action = "upsert";
    this.payload = Array.isArray(payload) ? payload : [payload];
    return this;
  }

  delete() {
    this.action = "delete";
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push({ column, operator: "=", value });
    return this;
  }

  single() {
    this.isSingle = true;
    this.limitVal = 1;
    return this;
  }

  maybeSingle() {
    this.isSingle = true;
    this.limitVal = 1;
    return this;
  }

  order(column: string, { ascending = false } = {}) {
    this.orderByCol = column;
    this.orderByDesc = !ascending;
    return this;
  }

  limit(val: number) {
    this.limitVal = val;
    return this;
  }

  async execute() {
    let doResult: { data: any; error: any } = { data: null, error: null };
    let supabaseResult: { data: any; error: any } = { data: null, error: null };

    // 1. Execute on DigitalOcean first if configured
    if (this.sqlDo) {
      doResult = await this.executeDigitalOcean();
    }

    // 2. Execute on Supabase second
    if (this.realSupabaseClient) {
      try {
        let builder: any = this.realSupabaseClient.from(this.table);
        if (this.action === "select") {
          builder = builder.select(this.columns);
        } else if (this.action === "insert") {
          builder = builder.insert(this.payload);
        } else if (this.action === "update") {
          builder = builder.update(this.payload);
        } else if (this.action === "upsert") {
          builder = builder.upsert(this.payload);
        } else if (this.action === "delete") {
          builder = builder.delete();
        }

        for (const f of this.filters) {
          if (f.operator === "=") {
            builder = builder.eq(f.column, f.value);
          }
        }

        if (this.orderByCol) {
          builder = builder.order(this.orderByCol, { ascending: !this.orderByDesc });
        }

        if (this.limitVal !== null) {
          builder = builder.limit(this.limitVal);
        }

        if (this.isSingle) {
          builder = builder.single();
        }

        supabaseResult = await builder;
      } catch (err) {
        supabaseResult = { data: null, error: err };
      }
    }

    // Since DO is the primary master, return DO's result if it was queried
    if (this.sqlDo) {
      if (doResult.error) {
        console.error(`DigitalOcean Primary Write/Read failed: ${doResult.error.message || doResult.error}`);
        // If DO failed but Supabase succeeded (and this was a write operation), we logs a warnings but still return DO's error to be strict.
        return doResult;
      }
      return doResult;
    }

    return supabaseResult;
  }

  private async executeDigitalOcean(): Promise<{ data: any; error: any }> {
    if (!this.sqlDo) return { data: null, error: new Error("No SQL connection available") };
    try {
      let result;
      let cleanCols = this.columns;
      let hasServicesRelation = false;

      // Translate Supabase relation selects (like services(title)) to raw table columns (service_title)
      if (cleanCols.includes("services(title)")) {
        cleanCols = cleanCols.replace("services(title)", "service_title");
        hasServicesRelation = true;
      }
      if (cleanCols.includes("services(*)")) {
        cleanCols = cleanCols.replace("services(*)", "service_title");
        hasServicesRelation = true;
      }

      if (this.action === "select") {
        let queryStr = `SELECT ${cleanCols} FROM ${this.table}`;
        const params: any[] = [];
        if (this.filters.length > 0) {
          const filterClauses = this.filters.map((f) => {
            params.push(f.value);
            return `"${f.column}" ${f.operator} $${params.length}`;
          });
          queryStr += ` WHERE ${filterClauses.join(" AND ")}`;
        }
        if (this.orderByCol) {
          queryStr += ` ORDER BY "${this.orderByCol}" ${this.orderByDesc ? "DESC" : "ASC"}`;
        }
        if (this.limitVal) {
          queryStr += ` LIMIT ${this.limitVal}`;
        }

        const rows = await this.sqlDo.unsafe(queryStr, params);
        result = this.isSingle ? (rows[0] || null) : rows;
      } 
      else if (this.action === "insert") {
        if (!this.payload || this.payload.length === 0) {
          return { data: null, error: null };
        }
        const rows = await this.sqlDo`
          INSERT INTO ${this.sqlDo(this.table)} ${this.sqlDo(this.payload)}
          RETURNING *
        `;
        result = this.isSingle ? (rows[0] || null) : rows;
      }
      else if (this.action === "update") {
        let queryStr = `UPDATE ${this.table} SET `;
        const params: any[] = [];
        const setClauses: string[] = [];
        for (const [k, v] of Object.entries(this.payload)) {
          params.push(v);
          setClauses.push(`"${k}" = $${params.length}`);
        }
        queryStr += setClauses.join(", ");

        if (this.filters.length > 0) {
          const filterClauses = this.filters.map((f) => {
            params.push(f.value);
            return `"${f.column}" ${f.operator} $${params.length}`;
          });
          queryStr += ` WHERE ${filterClauses.join(" AND ")}`;
        }
        queryStr += ` RETURNING *`;

        const rows = await this.sqlDo.unsafe(queryStr, params);
        result = this.isSingle ? (rows[0] || null) : rows;
      }
      else if (this.action === "upsert") {
        if (!this.payload || this.payload.length === 0) {
          return { data: null, error: null };
        }
        const conflictKey = this.table === "settings" ? "key" : "id";
        const cols = Object.keys(this.payload[0]);
        const updateCols = cols.filter((c) => c !== conflictKey);

        let rows;
        if (updateCols.length === 0) {
          rows = await this.sqlDo`
            INSERT INTO ${this.sqlDo(this.table)} ${this.sqlDo(this.payload)}
            ON CONFLICT (${this.sqlDo(conflictKey)}) DO NOTHING
            RETURNING *
          `;
        } else {
          rows = await this.sqlDo`
            INSERT INTO ${this.sqlDo(this.table)} ${this.sqlDo(this.payload)}
            ON CONFLICT (${this.sqlDo(conflictKey)}) 
            DO UPDATE SET ${this.sqlDo.unsafe(
              updateCols.map((c) => `"${c}" = EXCLUDED."${c}"`).join(", ")
            )}
            RETURNING *
          `;
        }
        result = this.isSingle ? (rows[0] || null) : rows;
      }
      else if (this.action === "delete") {
        let queryStr = `DELETE FROM ${this.table}`;
        const params: any[] = [];
        if (this.filters.length > 0) {
          const filterClauses = this.filters.map((f) => {
            params.push(f.value);
            return `"${f.column}" ${f.operator} $${params.length}`;
          });
          queryStr += ` WHERE ${filterClauses.join(" AND ")}`;
        }
        queryStr += ` RETURNING *`;

        const rows = await this.sqlDo.unsafe(queryStr, params);
        result = this.isSingle ? (rows[0] || null) : rows;
      }

      // Map relationship response formats back for compatibility (e.g. services: { title })
      const mapRow = (row: any) => {
        if (!row) return row;
        const newRow = { ...row };
        if (hasServicesRelation && "service_title" in newRow) {
          newRow.services = { title: newRow.service_title };
        }
        return newRow;
      };

      const finalResult = this.isSingle ? mapRow(result) : (Array.isArray(result) ? result.map(mapRow) : result);
      return { data: finalResult, error: null };
    } catch (err: any) {
      console.error(`DigitalOcean SQL transaction execution failed: ${err.message}`);
      return { data: null, error: err };
    }
  }

  then(onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any) {
    return this.execute().then(onfulfilled, onrejected);
  }
}

// ══════════════════════════════════════════════════════
//  REFACTORED DUAL-DB APIS (DIGITALOCEAN IS PRIMARY)
// ══════════════════════════════════════════════════════

export async function syncBackupAdminClients(
  operation: (client: any, label: BackupLabel) => Promise<{ error?: any } | void>,
  context: string
) {
  const results: Array<{ label: BackupLabel; error: any | null }> = [];

  // 1. Sync to DigitalOcean first (Master Write)
  try {
    const doClient = {
      from: (table: string) => new SpyQueryBuilder(table, null, getDigitalOceanSql()),
    };
    const result = await operation(doClient, "primary_supabase" as any); // mock label
    const error = result && "error" in result ? result.error : null;
    if (error) throw error;
  } catch (err) {
    console.error(`DigitalOcean sync in ${context} failed:`, err);
  }

  // 2. Sync to Supabase backups (including main project!) in parallel.
  const backupResults = await Promise.all(
    getBackupAdminClients().map(async (backup) => {
      try {
        const backupSpy = {
          from: (table: string) => new SpyQueryBuilder(table, backup.client, null),
        };
        const result = await operation(backupSpy, backup.label);
        const error = result && "error" in result ? result.error : null;
        if (error) throw error;
        return { label: backup.label, error: null };
      } catch (err) {
        console.error(`${backup.displayName} DB ${context} failed:`, err);
        return { label: backup.label, error: err };
      }
    })
  );

  results.push(...backupResults);

  return results;
}

/**
 * Executes a write operation on primary (DigitalOcean) and every configured backup.
 * If primary fails, the first successful backup keeps the request operational.
 */
export async function dualWrite<T = any>(
  operation: (client: any) => Promise<{ data: T | null; error: any }>
): Promise<{ data: T | null; error: any; databaseUsed: DatabaseUsed }> {
  const sqlDo = getDigitalOceanSql();
  const backups = getBackupAdminClients();

  let primaryResult: T | null = null;
  let primaryError: any = null;
  const backupResults: Array<{ label: BackupLabel; data: T | null; error: any }> = [];

  // 1. Write to DigitalOcean first (Master Write)
  try {
    const doClient = {
      from: (table: string) => new SpyQueryBuilder(table, null, sqlDo),
    };
    const res = await operation(doClient);
    primaryResult = res.data;
    primaryError = res.error;
  } catch (err: any) {
    primaryError = err;
  }

  // 2. Write to Supabase backups as replicas in parallel.
  backupResults.push(...await Promise.all(
    backups.map(async (backup) => {
      try {
        const backupSpy = {
          from: (table: string) => new SpyQueryBuilder(table, backup.client, null),
        };
        const res = await operation(backupSpy);
        return { label: backup.label, data: res.data, error: res.error };
      } catch (err: any) {
        return { label: backup.label, data: null, error: err };
      }
    })
  ));

  if (!primaryError) {
    const allBackupsSynced = backupResults.every((result) => !result.error);
    return {
      data: primaryResult,
      error: null,
      databaseUsed: backups.length > 0 && allBackupsSynced ? "both" : "primary",
    };
  }

  console.warn("DigitalOcean primary database write failed. Falling back to Supabase backups:", primaryError.message || primaryError);

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
 * Executes a read operation against primary (DigitalOcean) first, then each configured backup.
 */
export async function fallbackRead<T = any>(
  operation: (client: any) => Promise<{ data: T | null; error: any }>
): Promise<{ data: T | null; error: any; databaseUsed: "primary" | BackupLabel }> {
  // 1. Try DigitalOcean first
  const sqlDo = getDigitalOceanSql();
  if (sqlDo) {
    try {
      const doClient = {
        from: (table: string) => new SpyQueryBuilder(table, null, sqlDo),
      };
      const res = await operation(doClient);
      if (!res.error) {
        return { data: res.data, error: null, databaseUsed: "primary" };
      }
      console.warn("DigitalOcean primary read failed. Falling back to Supabase backups...", res.error.message || res.error);
    } catch (err) {
      console.warn("DigitalOcean primary read network error. Falling back to Supabase backups...", err);
    }
  }

  // 2. Try Supabase backups (including main project)
  for (const backup of getBackupAdminClients()) {
    try {
      const backupSpy = {
        from: (table: string) => new SpyQueryBuilder(table, backup.client, null),
      };
      const res = await operation(backupSpy);
      if (!res.error) {
        return {
          data: res.data,
          error: null,
          databaseUsed: backup.label,
        };
      }
    } catch {
      // Continue to the next backup
    }
  }

  return {
    data: null,
    error: new Error("Primary, DigitalOcean and all backup databases failed."),
    databaseUsed: "backup" as any,
  };
}
