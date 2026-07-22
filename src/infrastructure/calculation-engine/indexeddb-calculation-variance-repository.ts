import { CalculationVarianceRepository } from "@/domain/calculation-engine/repositories/calculation-variance-repository";
import { CalculationVarianceAnalysis } from "@/domain/calculation-engine/calibration/calculation-variance";
import { VarianceToleranceProfile } from "@/domain/calculation-engine/calibration/variance-tolerance-profile";
import { CalculationVarianceRecord, VarianceToleranceProfileRecord } from "@/infrastructure/persistence/indexeddb/records";
import { tpvGetAllByIndex, tpvPut } from "@/infrastructure/persistence/indexeddb/tpv-db";
import { calculationVarianceToRecord, calculationVarianceFromRecord, varianceToleranceProfileToRecord, varianceToleranceProfileFromRecord } from "./calibration-mappers";

/** IndexedDB implementace `CalculationVarianceRepository` (AP-MCE-001 Fáze G
 *  §8/§9/§23). */
export class IndexedDbCalculationVarianceRepository implements CalculationVarianceRepository {
  async getByCalculation(calculationId: string, calculationRevision: number, tenantId: string): Promise<CalculationVarianceAnalysis | null> {
    const records = await tpvGetAllByIndex<CalculationVarianceRecord>("tpvCalculationVariances", "calculationId", calculationId);
    const match = records.find((r) => r.tenantId === tenantId && r.calculationRevision === calculationRevision);
    return match ? calculationVarianceFromRecord(match) : null;
  }

  async listByTenant(tenantId: string): Promise<CalculationVarianceAnalysis[]> {
    const records = await tpvGetAllByIndex<CalculationVarianceRecord>("tpvCalculationVariances", "tenantId", tenantId);
    return records.map(calculationVarianceFromRecord);
  }

  async save(analysis: CalculationVarianceAnalysis, tenantId: string): Promise<void> {
    await tpvPut("tpvCalculationVariances", calculationVarianceToRecord(analysis, tenantId));
  }

  async listToleranceProfiles(tenantId: string): Promise<VarianceToleranceProfile[]> {
    const records = await tpvGetAllByIndex<VarianceToleranceProfileRecord>("tpvVarianceToleranceProfiles", "tenantId", tenantId);
    return records.map(varianceToleranceProfileFromRecord);
  }

  async saveToleranceProfile(profile: VarianceToleranceProfile): Promise<void> {
    await tpvPut("tpvVarianceToleranceProfiles", varianceToleranceProfileToRecord(profile));
  }
}
