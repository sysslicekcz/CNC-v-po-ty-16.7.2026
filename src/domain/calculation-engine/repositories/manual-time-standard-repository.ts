import { ManualTimeStandard } from "../manual/manual-time-standard";
import type { ManualOperationSubtype } from "../manual/manual-operation-subtype";

/**
 * Port pro `ManualTimeStandard` (AP-MCE-001 Fáze F §5). Systémové (globální)
 * standardy mají `tenantId === undefined` a jsou viditelné VŠEM tenantům -
 * `findCandidates` proto vrací sjednocení systémových + tenantem vlastněných
 * řádků pro daný `operationSubtype`, `resolveManualTimeStandard()` (Domain,
 * čistá funkce) mezi nimi rozhodne podle priority zdrojů.
 */
export interface ManualTimeStandardRepository {
  getById(id: string, tenantId: string): Promise<ManualTimeStandard | null>;
  findCandidates(operationSubtype: ManualOperationSubtype, tenantId: string): Promise<ManualTimeStandard[]>;
  listByTenant(tenantId: string): Promise<ManualTimeStandard[]>;
  save(standard: ManualTimeStandard): Promise<void>;
  archive(id: string, tenantId: string, archivedAt: string): Promise<void>;
}
