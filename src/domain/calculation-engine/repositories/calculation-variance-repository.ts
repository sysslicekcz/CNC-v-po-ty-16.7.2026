import { CalculationVarianceAnalysis } from "../calibration/calculation-variance";
import { VarianceToleranceProfile } from "../calibration/variance-tolerance-profile";

/** Port pro `CalculationVarianceAnalysis` (AP-MCE-001 Fáze G §8/§23) - nese i
 *  `VarianceToleranceProfile` (§9), zadání pro ni samostatný port nevyžaduje
 *  (uzavřený seznam devíti portů §23 ji nejmenuje), je ale nedílnou
 *  konfigurací STEJNÉ analýzy - žít ve stejném portu je konzistentnější než
 *  desátý port navíc. Analýza samotná je immutable snapshot (žádné
 *  `archive`/`getVersion` - nová analýza = nový záznam, stará se nepřepisuje). */
export interface CalculationVarianceRepository {
  getByCalculation(calculationId: string, calculationRevision: number, tenantId: string): Promise<CalculationVarianceAnalysis | null>;
  listByTenant(tenantId: string): Promise<CalculationVarianceAnalysis[]>;
  save(analysis: CalculationVarianceAnalysis, tenantId: string): Promise<void>;

  listToleranceProfiles(tenantId: string): Promise<VarianceToleranceProfile[]>;
  saveToleranceProfile(profile: VarianceToleranceProfile): Promise<void>;
}
