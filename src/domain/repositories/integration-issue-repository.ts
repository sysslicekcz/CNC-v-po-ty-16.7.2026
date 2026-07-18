import { IntegrationIssue } from "../integrations/integration-issue";

/** Tenant-scoped. Stejně jako `IntegrationRunRepository` - auditní data, žádné
 *  mazání v tomhle kroku. */
export interface IntegrationIssueRepository {
  listByIntegrationRun(tenantId: string, integrationRunId: string): Promise<IntegrationIssue[]>;
  save(issue: IntegrationIssue): Promise<void>;
}
