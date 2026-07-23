import { TechnologyOperationCalculationLinkRepository } from "@/domain/calculation-engine/repositories/technology-operation-calculation-link-repository";
import { TechnologyOperationCalculationLink } from "@/domain/calculation-engine/workflow/technology-operation-calculation-link";
import { TechnologyOperationCalculationLinkRecord } from "@/infrastructure/persistence/indexeddb/records";
import { tpvGet, tpvGetAllByIndex, tpvPut } from "@/infrastructure/persistence/indexeddb/tpv-db";
import { technologyOperationCalculationLinkToRecord, technologyOperationCalculationLinkFromRecord } from "./workflow-mappers";

/** IndexedDB implementace `TechnologyOperationCalculationLinkRepository`
 *  (AP-MCE-001 Fáze H §17). */
export class IndexedDbTechnologyOperationCalculationLinkRepository implements TechnologyOperationCalculationLinkRepository {
  async getById(id: string, tenantId: string): Promise<TechnologyOperationCalculationLink | null> {
    const record = await tpvGet<TechnologyOperationCalculationLinkRecord>("tpvTechnologyOperationCalculationLinks", id);
    if (!record || record.tenantId !== tenantId) return null;
    return technologyOperationCalculationLinkFromRecord(record);
  }

  async listByTechnologyOperation(technologyOperationId: string, tenantId: string): Promise<TechnologyOperationCalculationLink[]> {
    const records = await tpvGetAllByIndex<TechnologyOperationCalculationLinkRecord>("tpvTechnologyOperationCalculationLinks", "technologyOperationId", technologyOperationId);
    return records.filter((r) => r.tenantId === tenantId).map(technologyOperationCalculationLinkFromRecord);
  }

  async listByCalculation(calculationId: string, tenantId: string): Promise<TechnologyOperationCalculationLink[]> {
    const records = await tpvGetAllByIndex<TechnologyOperationCalculationLinkRecord>("tpvTechnologyOperationCalculationLinks", "calculationId", calculationId);
    return records.filter((r) => r.tenantId === tenantId).map(technologyOperationCalculationLinkFromRecord);
  }

  async save(link: TechnologyOperationCalculationLink): Promise<void> {
    await tpvPut("tpvTechnologyOperationCalculationLinks", technologyOperationCalculationLinkToRecord(link));
  }
}
