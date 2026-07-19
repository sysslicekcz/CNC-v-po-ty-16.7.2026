import { IntegrationIssueRepository } from "@/domain/repositories/integration-issue-repository";
import { IntegrationIssue } from "@/domain/integrations/integration-issue";
import { IntegrationIssueRecord } from "../records";
import { integrationIssueToRecord, integrationIssueFromRecord } from "../mappers/integration-mapper";
import { tpvGetAllByIndex, tpvPut } from "../tpv-db";

export class IndexedDbIntegrationIssueRepository implements IntegrationIssueRepository {
  async listByIntegrationRun(tenantId: string, integrationRunId: string): Promise<IntegrationIssue[]> {
    const records = await tpvGetAllByIndex<IntegrationIssueRecord>("tpvIntegrationIssues", "tenantId", tenantId);
    return records.filter((r) => r.integrationRunId === integrationRunId).map(integrationIssueFromRecord);
  }

  async save(issue: IntegrationIssue): Promise<void> {
    await tpvPut("tpvIntegrationIssues", integrationIssueToRecord(issue));
  }
}
