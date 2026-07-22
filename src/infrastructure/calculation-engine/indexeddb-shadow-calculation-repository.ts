import { ShadowCalculationRepository } from "@/domain/calculation-engine/repositories/shadow-calculation-repository";
import { ShadowCalculationResult } from "@/domain/calculation-engine/calibration/shadow-mode";
import { ShadowCalculationResultRecord } from "@/infrastructure/persistence/indexeddb/records";
import { tpvGet, tpvGetAllByIndex, tpvPut } from "@/infrastructure/persistence/indexeddb/tpv-db";
import { shadowCalculationResultToRecord, shadowCalculationResultFromRecord } from "./calibration-mappers";

/** IndexedDB implementace `ShadowCalculationRepository` (AP-MCE-001 Fáze G
 *  §20/§23). */
export class IndexedDbShadowCalculationRepository implements ShadowCalculationRepository {
  async getById(id: string, tenantId: string): Promise<ShadowCalculationResult | null> {
    const record = await tpvGet<ShadowCalculationResultRecord>("tpvShadowCalculationResults", id);
    if (!record || record.tenantId !== tenantId) return null;
    return shadowCalculationResultFromRecord(record);
  }

  async listByOfficialCalculation(officialCalculationId: string, tenantId: string): Promise<ShadowCalculationResult[]> {
    const records = await tpvGetAllByIndex<ShadowCalculationResultRecord>("tpvShadowCalculationResults", "officialCalculationId", officialCalculationId);
    return records.filter((r) => r.tenantId === tenantId).map(shadowCalculationResultFromRecord);
  }

  async listByTenant(tenantId: string): Promise<ShadowCalculationResult[]> {
    const records = await tpvGetAllByIndex<ShadowCalculationResultRecord>("tpvShadowCalculationResults", "tenantId", tenantId);
    return records.map(shadowCalculationResultFromRecord);
  }

  async save(result: ShadowCalculationResult): Promise<void> {
    await tpvPut("tpvShadowCalculationResults", shadowCalculationResultToRecord(result));
  }
}
