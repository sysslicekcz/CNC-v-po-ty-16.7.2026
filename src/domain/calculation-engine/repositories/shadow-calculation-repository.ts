import { ShadowCalculationResult } from "../calibration/shadow-mode";

/** Port pro `ShadowCalculationResult` (AP-MCE-001 Fáze G §20/§23). */
export interface ShadowCalculationRepository {
  getById(id: string, tenantId: string): Promise<ShadowCalculationResult | null>;
  listByOfficialCalculation(officialCalculationId: string, tenantId: string): Promise<ShadowCalculationResult[]>;
  listByTenant(tenantId: string): Promise<ShadowCalculationResult[]>;
  save(result: ShadowCalculationResult): Promise<void>;
}
