import { MigrationIssue } from "./context";
import { MigrationCounters, MigrationRunStatus } from "@/infrastructure/persistence/indexeddb/records";

export interface ValidationCheckResult {
  name: string;
  passed: boolean;
  detail?: string;
}

export interface MigrationReport {
  migrationRunId: string;
  status: MigrationRunStatus;
  startedAt: string;
  finishedAt: string;
  sourceCounts: Record<string, number>;
  targetCounts: Record<string, number>;
  created: Record<string, number>;
  skipped: Record<string, number>;
  updated: Record<string, number>;
  warnings: MigrationIssue[];
  errors: MigrationIssue[];
  validation: {
    passed: boolean;
    checks: ValidationCheckResult[];
  };
}

export function buildReportFromCounters(
  migrationRunId: string,
  status: MigrationRunStatus,
  startedAt: number,
  finishedAt: number,
  counters: MigrationCounters,
  issues: MigrationIssue[],
  validationChecks: ValidationCheckResult[]
): MigrationReport {
  return {
    migrationRunId,
    status,
    startedAt: new Date(startedAt).toISOString(),
    finishedAt: new Date(finishedAt).toISOString(),
    sourceCounts: counters.sourceCounts,
    targetCounts: counters.targetCounts,
    created: counters.created,
    skipped: counters.skipped,
    updated: counters.updated,
    warnings: issues.filter((i) => i.severity === "warning"),
    errors: issues.filter((i) => i.severity === "error" || i.severity === "fatal"),
    validation: {
      passed: validationChecks.every((c) => c.passed),
      checks: validationChecks,
    },
  };
}
