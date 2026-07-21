import type { MachiningMode, MillingSubtype } from "./milling-subtype";

export type CoefficientTimeBucket = "cutting_time" | "setup_time" | "handling_time";

export interface CoefficientContribution {
  name: string;
  value: number;
  source: string;
  version?: string;
  appliedTo: CoefficientTimeBucket;
  /** Rozdíl v minutách, který koeficient přidal/ubral OPROTI základnímu
   *  (koeficient 1) na dané `appliedTo` části času - dopočítá volající
   *  (`MillingCalculationStrategy`), tady zůstává `undefined`. */
  impactMinutes?: number;
}

export interface ResolveMillingCoefficientsInput {
  machineCoefficient: number;
  materialCoefficient: number;
  complexityCoefficient?: number;
  operatorSkillCoefficient?: number;
  toolWearFactor?: number;
  historicalCalibrationCoefficient?: number;
  interruptedCut: boolean;
  machiningMode: MachiningMode;
  subtype: MillingSubtype;
  /** §11 "engagementCoefficient" - poměr radiálního záběru k průměru
   *  nástroje (0..1+), `undefined` = neznámé zapojení (koeficient 1). */
  radialEngagementRatio?: number;
  adaptiveClearing: boolean;
}

export interface ResolvedMillingCoefficients {
  contributions: CoefficientContribution[];
  combinedCuttingTimeCoefficient: number;
  combinedSetupTimeCoefficient: number;
  combinedHandlingTimeCoefficient: number;
}

/** MVP konstanty pro koeficienty, které Fáze D zatím nemá odvozené z reálných
 *  dat (§11) - zdokumentované, snadno nahraditelné, stejná filozofie jako
 *  Fáze C `turning-coefficients.ts`. */
const INTERRUPTED_CUT_COEFFICIENT = 1.15;
const MACHINING_MODE_COEFFICIENT: Record<MachiningMode, number> = {
  roughing: 1,
  semi_finishing: 1.05,
  finishing: 1.1,
};
/** §4/§11 "3D aproximace ... nižší confidenceScore" - i ČASOVĚ se aproximovaná
 *  dráha MVP modelu penalizuje mírnou přirážkou (nejistota v odhadu délky
 *  dráhy nad skutečnou plochou), odděleně od `threeDApproximation` confidence
 *  signálu (ten sráží DŮVĚRYHODNOST, tenhle koeficient sráží ČAS). */
const THREE_D_APPROXIMATION_COEFFICIENT = 1.2;
/** §11 "chipEvacuationCoefficient" - uzavřené útvary (kapsa/drážka/otvor) mají
 *  horší odvod třísky než otevřená plocha/kontura, MVP konstanta. */
const POOR_CHIP_EVACUATION_SUBTYPES = new Set<MillingSubtype>(["pocket_milling", "slot_milling", "drilling", "countersinking", "reaming", "threading"]);
const CHIP_EVACUATION_COEFFICIENT = 1.1;
/** §11 "engagementCoefficient" - vyšší radiální zapojení nástroje = vyšší
 *  zatížení/nižší efektivní rychlost, `adaptiveClearing` (trochoidní dráha)
 *  ho naopak SNIŽUJE (menší, ale kontrolovanější zápich). */
const ADAPTIVE_CLEARING_ENGAGEMENT_DISCOUNT = 0.9;

/**
 * `resolveMillingCoefficients` (AP-MCE-001 Fáze D §11) - JEDENÁCT POJMENOVANÝCH
 * koeficientů, KAŽDÝ zvlášť se svým zdrojem/verzí/dopadem (§11: "Neslučuj je
 * do jednoho anonymního čísla"), aplikovaných na SPRÁVNOU část času.
 */
export function resolveMillingCoefficients(input: ResolveMillingCoefficientsInput): ResolvedMillingCoefficients {
  const complexity = input.complexityCoefficient ?? 1;
  const operatorSkill = input.operatorSkillCoefficient ?? 1;
  const toolWear = input.toolWearFactor ?? 1;
  const historicalCalibration = input.historicalCalibrationCoefficient ?? 1;
  const interruptedCut = input.interruptedCut ? INTERRUPTED_CUT_COEFFICIENT : 1;
  const machiningMode = MACHINING_MODE_COEFFICIENT[input.machiningMode];
  const threeDApproximation = input.subtype === "three_d" ? THREE_D_APPROXIMATION_COEFFICIENT : 1;
  const chipEvacuation = POOR_CHIP_EVACUATION_SUBTYPES.has(input.subtype) ? CHIP_EVACUATION_COEFFICIENT : 1;

  const baseEngagement = 1 + 0.3 * Math.min(1, Math.max(0, input.radialEngagementRatio ?? 0));
  const engagement = input.adaptiveClearing ? baseEngagement * ADAPTIVE_CLEARING_ENGAGEMENT_DISCOUNT : baseEngagement;

  const contributions: CoefficientContribution[] = [
    { name: "machineCoefficient", value: input.machineCoefficient, source: "machine_profile", appliedTo: "cutting_time" },
    { name: "materialCoefficient", value: input.materialCoefficient, source: "material_profile", appliedTo: "cutting_time" },
    { name: "toolWearFactor", value: toolWear, source: "tool_wear_curve", appliedTo: "cutting_time" },
    {
      name: "historicalCalibrationCoefficient",
      value: historicalCalibration,
      source: input.historicalCalibrationCoefficient !== undefined ? "calibration_profile" : "default",
      appliedTo: "cutting_time",
    },
    {
      name: "interruptedCutCoefficient",
      value: interruptedCut,
      source: input.interruptedCut ? "input" : "default",
      appliedTo: "cutting_time",
    },
    { name: "machiningModeCoefficient", value: machiningMode, source: "machining_mode", appliedTo: "cutting_time" },
    { name: "engagementCoefficient", value: engagement, source: input.radialEngagementRatio !== undefined ? "tool_engagement" : "default", appliedTo: "cutting_time" },
    { name: "threeDApproximationCoefficient", value: threeDApproximation, source: "subtype", appliedTo: "cutting_time" },
    { name: "chipEvacuationCoefficient", value: chipEvacuation, source: "subtype", appliedTo: "cutting_time" },
    {
      name: "complexityCoefficient",
      value: complexity,
      source: input.complexityCoefficient !== undefined ? "input" : "default",
      appliedTo: "cutting_time",
    },
    {
      name: "complexityCoefficient",
      value: complexity,
      source: input.complexityCoefficient !== undefined ? "input" : "default",
      appliedTo: "setup_time",
    },
    {
      name: "operatorSkillCoefficient",
      value: operatorSkill,
      source: input.operatorSkillCoefficient !== undefined ? "input" : "default",
      appliedTo: "handling_time",
    },
  ];

  const combinedCuttingTimeCoefficient =
    input.machineCoefficient *
    input.materialCoefficient *
    toolWear *
    historicalCalibration *
    interruptedCut *
    machiningMode *
    engagement *
    threeDApproximation *
    chipEvacuation *
    complexity;

  return {
    contributions,
    combinedCuttingTimeCoefficient,
    combinedSetupTimeCoefficient: complexity,
    combinedHandlingTimeCoefficient: operatorSkill,
  };
}
