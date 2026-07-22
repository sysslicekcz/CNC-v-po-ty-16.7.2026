import { CalibrationProfile } from "../calibration/calibration-profile";
import { CalibrationProfileSnapshot } from "../calibration/calibration-profile-snapshot";

/** Port pro `CalibrationProfile` (AP-MCE-001 Fáze G §13/§23) - stejný vzor
 *  jako `MaterialProfileRepository`/`ToolProfileRepository` (Fáze B):
 *  `getSnapshot` vrací immutable `ProfileSnapshot` pro vložení do
 *  `CalculationContext`/`CalculationResult`, `getVersion` čte konkrétní
 *  historickou verzi beze změny aktuálního stavu. */
export interface CalibrationProfileRepository {
  getById(id: string, tenantId: string): Promise<CalibrationProfile | null>;
  listByTenant(tenantId: string): Promise<CalibrationProfile[]>;
  /** Kandidáti pro `resolveCalibrationProfile()` (§19) - repozitář sám
   *  NEROZHODUJE prioritu, jen vrátí vše použitelné pro danou kategorii. */
  listActiveCandidates(tenantId: string): Promise<CalibrationProfile[]>;
  save(profile: CalibrationProfile): Promise<void>;
  archive(id: string, tenantId: string, archivedAt: string): Promise<void>;
  getVersion(id: string, recordVersion: number, tenantId: string): Promise<CalibrationProfile | null>;
  getSnapshot(id: string, tenantId: string): Promise<CalibrationProfileSnapshot | null>;
}
