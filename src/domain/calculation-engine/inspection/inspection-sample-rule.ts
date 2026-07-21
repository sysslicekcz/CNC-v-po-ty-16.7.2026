import type { InspectionSamplingMode } from "./inspection-sampling-strategy";

/**
 * `sampleRule` (AP-MCE-001 Fáze F §7) - strukturovaný, ne plochý, přenašeč
 * parametrů pro `resolveSampleCount()` (§8) na úrovni JEDNOHO `Inspection
 * Feature` - přepisuje operační `samplingPlan`/`sampleSize`/`samplingFrequency`,
 * pokud je vyplněný. Strukturovaný tvar (ne 3 samostatná pole) je zvolen
 * schválně: "Pokud se později přidají normované sampling plány, nesmí být
 * nutné přepisovat InspectionCalculationStrategy" (§8) - nový režim znamená
 * jen nový volitelný parametr tady, ne novou signaturu.
 */
export interface InspectionSampleRule {
  mode: InspectionSamplingMode;
  frequency?: number;
  percentage?: number;
  sampleSize?: number;
  batchSize?: number;
  explicitCount?: number;
}
