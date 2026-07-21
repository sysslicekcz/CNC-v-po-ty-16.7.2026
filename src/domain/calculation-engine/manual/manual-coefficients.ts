import type { ErgonomicDemand, ComplexityLevel } from "./manual-operation-feature";
import type { ProductionSeriality } from "./manual-operation-subtype";

export type CoefficientTimeBucket = "manual_time" | "setup_time" | "handling_time";

export interface CoefficientContribution {
  name: string;
  value: number;
  source: string;
  version?: string;
  appliedTo: CoefficientTimeBucket;
  impactMinutes?: number;
}

export interface ResolveManualCoefficientsInput {
  complexityCoefficient?: number;
  operatorSkillCoefficient?: number;
  ergonomicCoefficient?: number;
  fatigueCoefficient?: number;
  workplaceCoefficient?: number;
  historicalCalibrationCoefficient?: number;
  ergonomicDemand?: ErgonomicDemand;
  complexityLevel?: ComplexityLevel;
  productionSeriality?: ProductionSeriality;
}

export interface ResolvedManualCoefficients {
  contributions: CoefficientContribution[];
  combinedManualTimeCoefficient: number;
  combinedSetupTimeCoefficient: number;
  combinedHandlingTimeCoefficient: number;
}

/** MVP mapování popisné úrovně (§3 `ergonomicDemand`/`complexityLevel`) na
 *  výchozí koeficient, POUZE pokud operace/feature nezadá explicitní číslo
 *  (§4 "AdjustedFeatureTime = BaseFeatureTime × ... "), stejná filozofie
 *  jako Fáze D `MACHINING_MODE_COEFFICIENT`. */
const ERGONOMIC_DEMAND_COEFFICIENT: Record<ErgonomicDemand, number> = { low: 1, medium: 1.1, high: 1.25 };
const COMPLEXITY_LEVEL_COEFFICIENT: Record<ComplexityLevel, number> = { low: 1, medium: 1.1, high: 1.25 };
/** §2 "productionSeriality" - vyšší sériovost = zaběhnutější, rychlejší
 *  opakování stejného úkonu (MVP konstanta, zdokumentovaná). */
const SERIALITY_COEFFICIENT: Record<ProductionSeriality, number> = {
  single_piece: 1.2,
  small_batch: 1.1,
  medium_batch: 1,
  large_batch: 0.95,
  mass_production: 0.9,
};

/**
 * `resolveManualCoefficients` (AP-MCE-001 Fáze F §13) - SEDM POJMENOVANÝCH
 * koeficientů, KAŽDÝ zvlášť se svým zdrojem/verzí/dopadem (§4 "Nepoužívej
 * anonymní souhrnný koeficient"), stejný vzor jako Fáze C/D/E.
 */
export function resolveManualCoefficients(input: ResolveManualCoefficientsInput): ResolvedManualCoefficients {
  const complexity = input.complexityCoefficient ?? (input.complexityLevel ? COMPLEXITY_LEVEL_COEFFICIENT[input.complexityLevel] : 1);
  const operatorSkill = input.operatorSkillCoefficient ?? 1;
  const ergonomic = input.ergonomicCoefficient ?? (input.ergonomicDemand ? ERGONOMIC_DEMAND_COEFFICIENT[input.ergonomicDemand] : 1);
  const fatigue = input.fatigueCoefficient ?? 1;
  const workplace = input.workplaceCoefficient ?? 1;
  const historicalCalibration = input.historicalCalibrationCoefficient ?? 1;
  const seriality = input.productionSeriality ? SERIALITY_COEFFICIENT[input.productionSeriality] : 1;

  const contributions: CoefficientContribution[] = [
    {
      name: "complexityCoefficient",
      value: complexity,
      source: input.complexityCoefficient !== undefined ? "input" : input.complexityLevel ? "complexity_level" : "default",
      appliedTo: "manual_time",
    },
    {
      name: "ergonomicCoefficient",
      value: ergonomic,
      source: input.ergonomicCoefficient !== undefined ? "input" : input.ergonomicDemand ? "ergonomic_demand" : "default",
      appliedTo: "manual_time",
    },
    { name: "fatigueCoefficient", value: fatigue, source: input.fatigueCoefficient !== undefined ? "input" : "default", appliedTo: "manual_time" },
    { name: "workplaceCoefficient", value: workplace, source: input.workplaceCoefficient !== undefined ? "input" : "default", appliedTo: "manual_time" },
    {
      name: "historicalCalibrationCoefficient",
      value: historicalCalibration,
      source: input.historicalCalibrationCoefficient !== undefined ? "calibration_profile" : "default",
      appliedTo: "manual_time",
    },
    { name: "serialityCoefficient", value: seriality, source: input.productionSeriality ? "production_seriality" : "default", appliedTo: "manual_time" },
    {
      name: "complexityCoefficient",
      value: complexity,
      source: input.complexityCoefficient !== undefined ? "input" : input.complexityLevel ? "complexity_level" : "default",
      appliedTo: "setup_time",
    },
    { name: "operatorSkillCoefficient", value: operatorSkill, source: input.operatorSkillCoefficient !== undefined ? "input" : "default", appliedTo: "handling_time" },
  ];

  const combinedManualTimeCoefficient = complexity * ergonomic * fatigue * workplace * historicalCalibration * seriality;

  return {
    contributions,
    combinedManualTimeCoefficient,
    combinedSetupTimeCoefficient: complexity,
    combinedHandlingTimeCoefficient: operatorSkill,
  };
}
