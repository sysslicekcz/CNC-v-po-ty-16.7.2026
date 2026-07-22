import { CalibrationProfileRepository } from "@/domain/calculation-engine/repositories/calibration-profile-repository";
import { CalibrationProfile } from "@/domain/calculation-engine/calibration/calibration-profile";
import { CalibrationProfileSnapshot } from "@/domain/calculation-engine/calibration/calibration-profile-snapshot";
import { CalibrationProfileRecord } from "@/infrastructure/persistence/indexeddb/records";
import { tpvGet, tpvGetAllByIndex, tpvPut } from "@/infrastructure/persistence/indexeddb/tpv-db";
import { calibrationProfileToRecord, calibrationProfileFromRecord } from "./calibration-mappers";

/** IndexedDB implementace `CalibrationProfileRepository` (AP-MCE-001 Fáze G
 *  §13/§23) - stejný vzor jako `IndexedDbToolProfileRepository` (Fáze B):
 *  `getVersion` čte konkrétní historickou verzi, `getSnapshot` vrací
 *  immutable projekci pro `CalculationContext`/`CalculationResult`. */
export class IndexedDbCalibrationProfileRepository implements CalibrationProfileRepository {
  async getById(id: string, tenantId: string): Promise<CalibrationProfile | null> {
    const record = await tpvGet<CalibrationProfileRecord>("tpvCalibrationProfiles", id);
    if (!record || record.tenantId !== tenantId) return null;
    return calibrationProfileFromRecord(record);
  }

  async listByTenant(tenantId: string): Promise<CalibrationProfile[]> {
    const records = await tpvGetAllByIndex<CalibrationProfileRecord>("tpvCalibrationProfiles", "tenantId", tenantId);
    return records.map(calibrationProfileFromRecord);
  }

  async listActiveCandidates(tenantId: string): Promise<CalibrationProfile[]> {
    const all = await this.listByTenant(tenantId);
    return all.filter((p) => p.isUsableInCalculation);
  }

  async save(profile: CalibrationProfile): Promise<void> {
    await tpvPut("tpvCalibrationProfiles", calibrationProfileToRecord(profile));
  }

  async archive(id: string, tenantId: string, archivedAt: string): Promise<void> {
    const existing = await this.getById(id, tenantId);
    if (!existing) return;
    await this.save(existing.archive(archivedAt));
  }

  async getVersion(id: string, recordVersion: number, tenantId: string): Promise<CalibrationProfile | null> {
    const existing = await this.getById(id, tenantId);
    if (!existing || existing.recordVersion !== recordVersion) return null;
    return existing;
  }

  async getSnapshot(id: string, tenantId: string): Promise<CalibrationProfileSnapshot | null> {
    const existing = await this.getById(id, tenantId);
    if (!existing) return null;
    return CalibrationProfileSnapshot.forCalibrationProfile(existing, { createdAt: new Date().toISOString() });
  }
}
