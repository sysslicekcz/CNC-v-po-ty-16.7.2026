import { CalibrationSampleRepository } from "@/domain/calculation-engine/repositories/calibration-sample-repository";
import { CalibrationSample } from "@/domain/calculation-engine/calibration/calibration-sample";
import { CalibrationSampleRecord } from "@/infrastructure/persistence/indexeddb/records";
import { tpvGet, tpvGetAllByIndex, tpvPut } from "@/infrastructure/persistence/indexeddb/tpv-db";
import { calibrationSampleToRecord, calibrationSampleFromRecord } from "./calibration-mappers";

/** IndexedDB implementace `CalibrationSampleRepository` (AP-MCE-001 Fáze G
 *  §11/§23). */
export class IndexedDbCalibrationSampleRepository implements CalibrationSampleRepository {
  async getById(id: string, tenantId: string): Promise<CalibrationSample | null> {
    const record = await tpvGet<CalibrationSampleRecord>("tpvCalibrationSamples", id);
    if (!record || record.tenantId !== tenantId) return null;
    return calibrationSampleFromRecord(record);
  }

  async listByTenant(tenantId: string): Promise<CalibrationSample[]> {
    const records = await tpvGetAllByIndex<CalibrationSampleRecord>("tpvCalibrationSamples", "tenantId", tenantId);
    return records.map(calibrationSampleFromRecord);
  }

  async listByDateRange(tenantId: string, fromIso: string, toIso: string): Promise<CalibrationSample[]> {
    const records = await tpvGetAllByIndex<CalibrationSampleRecord>("tpvCalibrationSamples", "tenantId", tenantId);
    return records.filter((r) => r.createdAt >= fromIso && r.createdAt <= toIso).map(calibrationSampleFromRecord);
  }

  async save(sample: CalibrationSample): Promise<void> {
    await tpvPut("tpvCalibrationSamples", calibrationSampleToRecord(sample));
  }

  async saveMany(samples: readonly CalibrationSample[]): Promise<void> {
    for (const sample of samples) await this.save(sample);
  }
}
