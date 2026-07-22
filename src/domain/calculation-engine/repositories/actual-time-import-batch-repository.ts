import { ActualTimeImportBatch, ActualTimeImportMapping } from "../calibration/actual-time-import";

/** Port pro `ActualTimeImportBatch`/`ActualTimeImportMapping` (AP-MCE-001
 *  Fáze G §5/§23). */
export interface ActualTimeImportBatchRepository {
  getById(id: string, tenantId: string): Promise<ActualTimeImportBatch | null>;
  listByTenant(tenantId: string): Promise<ActualTimeImportBatch[]>;
  save(batch: ActualTimeImportBatch): Promise<void>;

  getMappingById(id: string, tenantId: string): Promise<ActualTimeImportMapping | null>;
  listMappingsByTenant(tenantId: string): Promise<ActualTimeImportMapping[]>;
  saveMapping(mapping: ActualTimeImportMapping): Promise<void>;
}
