import { IntegrationRunRepository } from "@/domain/repositories/integration-run-repository";
import { IntegrationRun } from "@/domain/integrations/integration-run";
import { IntegrationRunRecord } from "../records";
import { integrationRunToRecord, integrationRunFromRecord } from "../mappers/integration-mapper";
import { tpvGetAllByIndex, tpvGet, tpvPut } from "../tpv-db";

export class IndexedDbIntegrationRunRepository implements IntegrationRunRepository {
  async findById(id: string, tenantId: string): Promise<IntegrationRun | null> {
    const record = await tpvGet<IntegrationRunRecord>("tpvIntegrationRuns", id);
    if (!record || record.tenantId !== tenantId) return null;
    return integrationRunFromRecord(record);
  }

  async listByExternalSystem(tenantId: string, externalSystemId: string): Promise<IntegrationRun[]> {
    const records = await tpvGetAllByIndex<IntegrationRunRecord>("tpvIntegrationRuns", "tenantId", tenantId);
    return records.filter((r) => r.externalSystemId === externalSystemId).map(integrationRunFromRecord);
  }

  async save(run: IntegrationRun): Promise<void> {
    await tpvPut("tpvIntegrationRuns", integrationRunToRecord(run));
  }
}
