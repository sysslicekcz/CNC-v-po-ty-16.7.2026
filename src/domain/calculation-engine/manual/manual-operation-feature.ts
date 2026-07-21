import type { ManualOperationSubtype, ManualQuantityBasis, ManualTimeBasis } from "./manual-operation-subtype";

/** §3 "ergonomicDemand"/"complexityLevel" - popisná úroveň featuru, ze které
 *  strategie odvodí VÝCHOZÍ hodnotu `ergonomicCoefficient`/`complexity
 *  Coefficient` (§13), POKUD operace/feature nezadá explicitní číslo. */
export type ErgonomicDemand = "low" | "medium" | "high";
export type ComplexityLevel = "low" | "medium" | "high";

/** Kdy se má u featuru provést měření (stejný tvar jako Fáze C/D/E) -
 *  `"none"` je výchozí (typický ruční úsek žádné měření nemá). */
export type ManualMeasurementRequirement = "none" | "first_piece" | "every_piece" | "sampling";

/**
 * Jeden ruční úsek operace (AP-MCE-001 Fáze F §3) - jedna operace nese
 * `ManualOperationCalculationInput.features: ManualOperationFeature[]`, v
 * POŘADÍ `sequence` (§3 "zachovat pořadí"). Stejný princip jako Fáze C/D/E -
 * jedna operace může kombinovat víc ručních úseků (např. "odjehlení" +
 * "čištění" + "balení" jako tři samostatné featury).
 */
export interface ManualOperationFeature {
  id: string;
  sequence: number;
  subtype: ManualOperationSubtype;
  quantityBasis: ManualQuantityBasis;
  timeBasis: ManualTimeBasis;
  /** Základní (NEUPRAVENÝ) čas featuru v minutách - význam závisí na
   *  `quantityBasis` (na kus / na dávku / na zakázku / na výskyt). Povinné
   *  jen pro `timeBasis === "explicit"` - u ostatních `timeBasis` (šablona/
   *  historický průměr/pravidlo/normovaný čas) ho STRATEGIE dopočítá z
   *  `CalculationContext.manualTimeStandardsByFeatureId` (Application vrstva
   *  ho tam předem vyřeší přes `ManualTimeStandardRepository`, stejný vzor
   *  jako Fáze C `turningCuttingConditionsByFeatureId`) - pokud je tu i tak
   *  vyplněné, bere se jako informativní poslední známá hodnota, ne jako
   *  závazný zdroj pro `timeBasis !== "explicit"`. */
  baseTimeMin?: number;
  /** Kolikrát se featur v rámci svého `quantityBasis` opakuje (výchozí 1) -
   *  např. "3 hrany k odjehlení" na jednom kuse (§3 "započítat opakování"). */
  repetitionCount?: number;
  employeeQualificationId?: string;
  toolOrEquipmentId?: string;
  workstationRequirement?: string;
  ergonomicDemand?: ErgonomicDemand;
  complexityLevel?: ComplexityLevel;
  measurementRequirement?: ManualMeasurementRequirement;
  notes?: string;
}
