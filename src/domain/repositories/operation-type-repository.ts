import { OperationType } from "../entities/operation-type";

/** Tenant-scoped od Kroku 5 (dřív globální číselník, viz docs/audits/step-5-audit.md) -
 *  `OperationType` se poprvé stává uživatelsky editovatelným kmenovým záznamem. */
export interface OperationTypeRepository {
  findById(id: string, tenantId: string): Promise<OperationType | null>;
  findByCode(tenantId: string, kod: string): Promise<OperationType | null>;
  list(tenantId: string): Promise<OperationType[]>;
  save(operationType: OperationType): Promise<void>;
  delete(id: string, tenantId: string): Promise<void>;
}
