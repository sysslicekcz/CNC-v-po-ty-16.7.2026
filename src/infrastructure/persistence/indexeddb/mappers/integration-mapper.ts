import { IntegrationRun, IntegrationDirection, IntegrationMode, IntegrationRunStatus } from "@/domain/integrations/integration-run";
import { IntegrationIssue, IntegrationIssueType, IntegrationIssueSeverity, IntegrationIssueStatus } from "@/domain/integrations/integration-issue";
import { IntegrationRunRecord, IntegrationIssueRecord } from "../records";
import { parseEntityStavLike } from "./common";

const DIRECTION_VALUES = ["import", "export", "sync"] as const satisfies readonly IntegrationDirection[];
const MODE_VALUES = ["manual", "scheduled", "automatic"] as const satisfies readonly IntegrationMode[];
const RUN_STATUS_VALUES = [
  "pending",
  "running",
  "completed",
  "completed_with_warnings",
  "failed",
  "cancelled",
] as const satisfies readonly IntegrationRunStatus[];

export function integrationRunToRecord(run: IntegrationRun): IntegrationRunRecord {
  return { ...run };
}

export function integrationRunFromRecord(record: IntegrationRunRecord): IntegrationRun {
  return {
    id: record.id,
    tenantId: record.tenantId,
    externalSystemId: record.externalSystemId,
    direction: parseEntityStavLike(record.direction, DIRECTION_VALUES, "IntegrationRun.direction"),
    mode: parseEntityStavLike(record.mode, MODE_VALUES, "IntegrationRun.mode"),
    status: parseEntityStavLike(record.status, RUN_STATUS_VALUES, "IntegrationRun.status"),
    startedAt: record.startedAt,
    finishedAt: record.finishedAt,
    createdCount: record.createdCount,
    updatedCount: record.updatedCount,
    skippedCount: record.skippedCount,
    errorCount: record.errorCount,
  };
}

const ISSUE_TYPE_VALUES = [
  "unknown_external_entity",
  "missing_required_field",
  "ambiguous_match",
  "duplicate_external_reference",
  "local_external_conflict",
  "unsupported_entity",
  "invalid_data",
] as const satisfies readonly IntegrationIssueType[];
const ISSUE_SEVERITY_VALUES = ["info", "warning", "error"] as const satisfies readonly IntegrationIssueSeverity[];
const ISSUE_STATUS_VALUES = ["open", "resolved", "ignored"] as const satisfies readonly IntegrationIssueStatus[];

export function integrationIssueToRecord(issue: IntegrationIssue): IntegrationIssueRecord {
  return { ...issue };
}

export function integrationIssueFromRecord(record: IntegrationIssueRecord): IntegrationIssue {
  return {
    id: record.id,
    tenantId: record.tenantId,
    externalSystemId: record.externalSystemId,
    integrationRunId: record.integrationRunId,
    entityType: record.entityType,
    externalId: record.externalId,
    externalCode: record.externalCode,
    localEntityId: record.localEntityId,
    type: parseEntityStavLike(record.type, ISSUE_TYPE_VALUES, "IntegrationIssue.type"),
    severity: parseEntityStavLike(record.severity, ISSUE_SEVERITY_VALUES, "IntegrationIssue.severity"),
    message: record.message,
    status: parseEntityStavLike(record.status, ISSUE_STATUS_VALUES, "IntegrationIssue.status"),
  };
}
