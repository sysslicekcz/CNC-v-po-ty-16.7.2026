export type IssueSeverity = "info" | "warning" | "error" | "fatal";

export interface MigrationIssueRecord {
  id: string;
  migrationRunId: string;
  tenantId: string;
  severity: IssueSeverity;
  phase: string;
  code: string;
  message: string;
  legacySource?: string;
  legacyId?: string;
  createdAt: number;
}

export interface MigrationCounters {
  sourceCounts: Record<string, number>;
  targetCounts: Record<string, number>;
  created: Record<string, number>;
  skipped: Record<string, number>;
  updated: Record<string, number>;
}

export function emptyMigrationCounters(): MigrationCounters {
  return { sourceCounts: {}, targetCounts: {}, created: {}, skipped: {}, updated: {} };
}

export type MigrationRunStatus =
  | "pending"
  | "running"
  | "validating"
  | "completed"
  | "completed_with_warnings"
  | "failed"
  | "rolled_back";

export interface MigrationRunRecord {
  id: string;
  tenantId: string;
  migrationVersion: string;
  status: MigrationRunStatus;
  startedAt?: number;
  finishedAt?: number;
  sourceDbVersion: number;
  targetDbVersion: number;
  counters: MigrationCounters;
  error?: string;
}

/** Zálohovaný snímek starých stores z okamžiku, kdy migrační běh začal - viz
 *  infrastructure/migration/phases/backup.ts. `bundleJson` je serializovaný
 *  BackupBundle ze stávajícího src/lib/backup.ts::exportBackup() (žádná
 *  duplikace logiky zálohy - jen se sesbíraný bundle uloží trvale, ne jen do
 *  paměti prohlížeče). */
export interface MigrationBackupRecord {
  id: string; // = migrationRunId
  createdAt: number;
  sourceDbVersion: number;
  counts: Record<string, number>;
  checksum: string;
  bundleJson: string;
}
