import { ActualTimeRecord } from "../calibration/actual-time-record";

/** Port pro `ActualTimeRecord` (AP-MCE-001 Fáze G §2/§23) - tenant-scoped,
 *  stejný vzor jako `ManualTimeStandardRepository`. */
export interface ActualTimeRecordRepository {
  getById(id: string, tenantId: string): Promise<ActualTimeRecord | null>;
  listByTenant(tenantId: string): Promise<ActualTimeRecord[]>;
  listByCalculation(calculationId: string, tenantId: string): Promise<ActualTimeRecord[]>;
  listByOperation(operationId: string, tenantId: string): Promise<ActualTimeRecord[]>;
  listByDateRange(tenantId: string, fromIso: string, toIso: string): Promise<ActualTimeRecord[]>;
  listUnmatched(tenantId: string): Promise<ActualTimeRecord[]>;
  save(record: ActualTimeRecord): Promise<void>;
  saveMany(records: readonly ActualTimeRecord[]): Promise<void>;
  archive(id: string, tenantId: string, archivedAt: string): Promise<void>;
}
