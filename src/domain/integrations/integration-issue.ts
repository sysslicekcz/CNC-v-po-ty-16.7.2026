export type IntegrationIssueType =
  | "unknown_external_entity"
  | "missing_required_field"
  | "ambiguous_match"
  | "duplicate_external_reference"
  | "local_external_conflict"
  | "unsupported_entity"
  | "invalid_data";

export type IntegrationIssueSeverity = "info" | "warning" | "error";
export type IntegrationIssueStatus = "open" | "resolved" | "ignored";

/** ERP-neutrální problém zjištěný během jednoho `IntegrationRun` - obdoba
 *  `MigrationIssueRecord` (Krok 3), ale pro opakovanou integraci s externím
 *  systémem. */
export interface IntegrationIssue {
  id: string;
  tenantId: string;
  externalSystemId: string;
  integrationRunId: string;

  entityType: string;
  externalId?: string;
  externalCode?: string;
  localEntityId?: string;

  type: IntegrationIssueType;
  severity: IntegrationIssueSeverity;
  message: string;
  status: IntegrationIssueStatus;
}
