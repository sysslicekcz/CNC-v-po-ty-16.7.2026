import { ActualTimeImportBatchRepository } from "@/domain/calculation-engine/repositories/actual-time-import-batch-repository";
import { ActualTimeImportBatch, ActualTimeImportMapping } from "@/domain/calculation-engine/calibration/actual-time-import";
import { ActualTimeImportBatchRecord, ActualTimeImportMappingRecord } from "@/infrastructure/persistence/indexeddb/records";
import { tpvGet, tpvGetAllByIndex, tpvPut } from "@/infrastructure/persistence/indexeddb/tpv-db";
import { actualTimeImportBatchToRecord, actualTimeImportBatchFromRecord, actualTimeImportMappingToRecord, actualTimeImportMappingFromRecord } from "./calibration-mappers";

/** IndexedDB implementace `ActualTimeImportBatchRepository` (AP-MCE-001
 *  Fáze G §5/§23) - nese i `ActualTimeImportMapping` (stejný důvod jako u
 *  portu samotného - jeden port pro celou importní konfiguraci). */
export class IndexedDbActualTimeImportBatchRepository implements ActualTimeImportBatchRepository {
  async getById(id: string, tenantId: string): Promise<ActualTimeImportBatch | null> {
    const record = await tpvGet<ActualTimeImportBatchRecord>("tpvActualTimeImportBatches", id);
    if (!record || record.tenantId !== tenantId) return null;
    return actualTimeImportBatchFromRecord(record);
  }

  async listByTenant(tenantId: string): Promise<ActualTimeImportBatch[]> {
    const records = await tpvGetAllByIndex<ActualTimeImportBatchRecord>("tpvActualTimeImportBatches", "tenantId", tenantId);
    return records.map(actualTimeImportBatchFromRecord);
  }

  async save(batch: ActualTimeImportBatch): Promise<void> {
    await tpvPut("tpvActualTimeImportBatches", actualTimeImportBatchToRecord(batch));
  }

  async getMappingById(id: string, tenantId: string): Promise<ActualTimeImportMapping | null> {
    const record = await tpvGet<ActualTimeImportMappingRecord>("tpvActualTimeImportMappings", id);
    if (!record || record.tenantId !== tenantId) return null;
    return actualTimeImportMappingFromRecord(record);
  }

  async listMappingsByTenant(tenantId: string): Promise<ActualTimeImportMapping[]> {
    const records = await tpvGetAllByIndex<ActualTimeImportMappingRecord>("tpvActualTimeImportMappings", "tenantId", tenantId);
    return records.map(actualTimeImportMappingFromRecord);
  }

  async saveMapping(mapping: ActualTimeImportMapping): Promise<void> {
    await tpvPut("tpvActualTimeImportMappings", actualTimeImportMappingToRecord(mapping));
  }
}
