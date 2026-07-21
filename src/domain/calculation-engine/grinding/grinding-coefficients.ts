import type { MachiningMode, GrindingSubtype } from "./grinding-subtype";

export type CoefficientTimeBucket = "grinding_time" | "setup_time" | "handling_time";

export interface CoefficientContribution {
  name: string;
  value: number;
  source: string;
  version?: string;
  appliedTo: CoefficientTimeBucket;
  impactMinutes?: number;
}

export interface ResolveGrindingCoefficientsInput {
  machineCoefficient: number;
  materialCoefficient: number;
  complexityCoefficient?: number;
  operatorSkillCoefficient?: number;
  wheelWearFactor?: number;
  historicalCalibrationCoefficient?: number;
  machiningMode: MachiningMode;
  subtype: GrindingSubtype;
  /** `undefined` = neznámá přesnost stroje (§9/§14 "neznámou přesnost
   *  stroje" confidence signál i koeficient). */
  machinePositioningAccuracyKnown: boolean;
  /** `true`, pokud interval orovnání NEBYL zadán (§7 "Dressing interval
   *  defaulted") - konzervativní přirážka na neznámý stav kotouče. */
  usedDefaultDressingInterval: boolean;
  coolantEnabled: boolean;
}

export interface ResolvedGrindingCoefficients {
  contributions: CoefficientContribution[];
  combinedGrindingTimeCoefficient: number;
  combinedSetupTimeCoefficient: number;
  combinedHandlingTimeCoefficient: number;
}

/** MVP konstanty (AP-MCE-001 Fáze E §13), stejná filozofie jako Fáze C/D. */
const FINISH_GRINDING_COEFFICIENT: Record<MachiningMode, number> = {
  roughing: 1,
  semi_finishing: 1.1,
  finishing: 1.25,
};
const INTERNAL_GRINDING_COEFFICIENT = 1.2;
const CENTERLESS_APPROXIMATION_COEFFICIENT = 1.15;
const CREEP_FEED_APPROXIMATION_COEFFICIENT = 1.3;
const UNKNOWN_PRECISION_COEFFICIENT = 1.05;
const UNDRESSED_CONDITION_COEFFICIENT = 1.1;
const NO_COOLANT_COEFFICIENT = 1.05;

const CENTERLESS_SUBTYPES = new Set<GrindingSubtype>(["centerless_through_feed", "centerless_in_feed"]);

/**
 * `resolveGrindingCoefficients` (AP-MCE-001 Fáze E §13) - TŘINÁCT
 * POJMENOVANÝCH koeficientů, KAŽDÝ zvlášť se svým zdrojem/verzí/dopadem
 * (§13: "Neslučuj je do jednoho anonymního čísla"), stejný vzor jako Fáze
 * C/D `resolve*Coefficients`.
 */
export function resolveGrindingCoefficients(input: ResolveGrindingCoefficientsInput): ResolvedGrindingCoefficients {
  const complexity = input.complexityCoefficient ?? 1;
  const operatorSkill = input.operatorSkillCoefficient ?? 1;
  const wheelWear = input.wheelWearFactor ?? 1;
  const historicalCalibration = input.historicalCalibrationCoefficient ?? 1;
  const finishGrinding = FINISH_GRINDING_COEFFICIENT[input.machiningMode];
  const internalGrinding = input.subtype === "internal_cylindrical" ? INTERNAL_GRINDING_COEFFICIENT : 1;
  const centerlessApproximation = CENTERLESS_SUBTYPES.has(input.subtype) ? CENTERLESS_APPROXIMATION_COEFFICIENT : 1;
  const creepFeedApproximation = input.subtype === "surface_creep_feed" ? CREEP_FEED_APPROXIMATION_COEFFICIENT : 1;
  const precision = input.machinePositioningAccuracyKnown ? 1 : UNKNOWN_PRECISION_COEFFICIENT;
  const dressingCondition = input.usedDefaultDressingInterval ? UNDRESSED_CONDITION_COEFFICIENT : 1;
  const coolant = input.coolantEnabled ? 1 : NO_COOLANT_COEFFICIENT;

  const contributions: CoefficientContribution[] = [
    { name: "machineCoefficient", value: input.machineCoefficient, source: "machine_profile", appliedTo: "grinding_time" },
    { name: "materialCoefficient", value: input.materialCoefficient, source: "material_profile", appliedTo: "grinding_time" },
    { name: "wheelWearFactor", value: wheelWear, source: "wheel_wear_curve", appliedTo: "grinding_time" },
    {
      name: "historicalCalibrationCoefficient",
      value: historicalCalibration,
      source: input.historicalCalibrationCoefficient !== undefined ? "calibration_profile" : "default",
      appliedTo: "grinding_time",
    },
    { name: "internalGrindingCoefficient", value: internalGrinding, source: "subtype", appliedTo: "grinding_time" },
    { name: "finishGrindingCoefficient", value: finishGrinding, source: "machining_mode", appliedTo: "grinding_time" },
    { name: "precisionCoefficient", value: precision, source: input.machinePositioningAccuracyKnown ? "machine_profile" : "default", appliedTo: "grinding_time" },
    { name: "centerlessApproximationCoefficient", value: centerlessApproximation, source: "subtype", appliedTo: "grinding_time" },
    { name: "creepFeedApproximationCoefficient", value: creepFeedApproximation, source: "subtype", appliedTo: "grinding_time" },
    { name: "coolantCoefficient", value: coolant, source: input.coolantEnabled ? "input" : "default", appliedTo: "grinding_time" },
    { name: "dressingConditionCoefficient", value: dressingCondition, source: input.usedDefaultDressingInterval ? "default" : "input", appliedTo: "grinding_time" },
    { name: "complexityCoefficient", value: complexity, source: input.complexityCoefficient !== undefined ? "input" : "default", appliedTo: "grinding_time" },
    { name: "complexityCoefficient", value: complexity, source: input.complexityCoefficient !== undefined ? "input" : "default", appliedTo: "setup_time" },
    { name: "operatorSkillCoefficient", value: operatorSkill, source: input.operatorSkillCoefficient !== undefined ? "input" : "default", appliedTo: "handling_time" },
  ];

  const combinedGrindingTimeCoefficient =
    input.machineCoefficient *
    input.materialCoefficient *
    wheelWear *
    historicalCalibration *
    internalGrinding *
    finishGrinding *
    precision *
    centerlessApproximation *
    creepFeedApproximation *
    coolant *
    complexity;

  return {
    contributions,
    combinedGrindingTimeCoefficient,
    combinedSetupTimeCoefficient: complexity,
    combinedHandlingTimeCoefficient: operatorSkill,
  };
}
