import { ActualTimeRecordRepository } from "@/domain/calculation-engine/repositories/actual-time-record-repository";
import { ActualTimeRecord } from "@/domain/calculation-engine/calibration/actual-time-record";
import { ActualTimeRecordRecord } from "@/infrastructure/persistence/indexeddb/records";
import { tpvGet, tpvGetAll, tpvGetAllByIndex, tpvPut } from "@/infrastructure/persistence/indexeddb/tpv-db";
import { actualTimeRecordToRecord, actualTimeRecordFromRecord } from "./calibration-mappers";

/** IndexedDB implementace `ActualTimeRecordRepository` (AP-MCE-001 Fáze G
 *  §2/§23) - stejný vzor jako `IndexedDbManualTimeStandardRepository`. */
export class IndexedDbActualTimeRecordRepository implements ActualTimeRecordRepository {
  async getById(id: string, tenantId: string): Promise<ActualTimeRecord | null> {
    const record = await tpvGet<ActualTimeRecordRecord>("tpvActualTimeRecords", id);
    if (!record || record.tenantId !== tenantId) return null;
    return actualTimeRecordFromRecord(record);
  }

  async listByTenant(tenantId: string): Promise<ActualTimeRecord[]> {
    const records = await tpvGetAllByIndex<ActualTimeRecordRecord>("tpvActualTimeRecords", "tenantId", tenantId);
    return records.map(actualTimeRecordFromRecord);
  }

  async listByCalculation(calculationId: string, tenantId: string): Promise<ActualTimeRecord[]> {
    const records = await tpvGetAllByIndex<ActualTimeRecordRecord>("tpvActualTimeRecords", "calculationId", calculationId);
    return records.filter((r) => r.tenantId === tenantId).map(actualTimeRecordFromRecord);
  }

  async listByOperation(operationId: string, tenantId: string): Promise<ActualTimeRecord[]> {
    const records = await tpvGetAllByIndex<ActualTimeRecordRecord>("tpvActualTimeRecords", "operationId", operationId);
    return records.filter((r) => r.tenantId === tenantId).map(actualTimeRecordFromRecord);
  }

  async listByDateRange(tenantId: string, fromIso: string, toIso: string): Promise<ActualTimeRecord[]> {
    const records = await tpvGetAllByIndex<ActualTimeRecordRecord>("tpvActualTimeRecords", "tenantId", tenantId);
    return records.filter((r) => r.recordedAt >= fromIso && r.recordedAt <= toIso).map(actualTimeRecordFromRecord);
  }

  async listUnmatched(tenantId: string): Promise<ActualTimeRecord[]> {
    const records = await tpvGetAll<ActualTimeRecordRecord>("tpvActualTimeRecords");
    return records.filter((r) => r.tenantId === tenantId && !r.calculationId).map(actualTimeRecordFromRecord);
  }

  async save(record: ActualTimeRecord): Promise<void> {
    await tpvPut("tpvActualTimeRecords", actualTimeRecordToRecord(record));
  }

  async saveMany(records: readonly ActualTimeRecord[]): Promise<void> {
    for (const record of records) await this.save(record);
  }

  async archive(id: string, tenantId: string, archivedAt: string): Promise<void> {
    const existing = await this.getById(id, tenantId);
    if (!existing) return;
    await this.save(existing.archive(archivedAt));
  }
}
