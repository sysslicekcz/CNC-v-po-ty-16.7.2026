import type { MachiningMode } from "./turning-subtype";

export type CoefficientTimeBucket = "cutting_time" | "setup_time" | "handling_time";

export interface CoefficientContribution {
  name: string;
  value: number;
  source: string;
  version?: string;
  appliedTo: CoefficientTimeBucket;
  /** Rozdíl v minutách, který koeficient přidal/ubral OPROTI základnímu
   *  (koeficient 1) na dané `appliedTo` části času - dopočítá až volající
   *  (`TurningCalculationStrategy`), tady zůstává `undefined`, dokud
   *  strategie nezná základní čas, na který se aplikuje. */
  impactMinutes?: number;
}

export interface ResolveTurningCoefficientsInput {
  machineCoefficient: number;
  materialCoefficient: number;
  complexityCoefficient?: number;
  operatorSkillCoefficient?: number;
  toolWearFactor?: number;
  historicalCalibrationCoefficient?: number;
  interruptedCut: boolean;
  internalMachining: boolean;
  machiningMode: MachiningMode;
}

export interface ResolvedTurningCoefficients {
  contributions: CoefficientContribution[];
  combinedCuttingTimeCoefficient: number;
  combinedSetupTimeCoefficient: number;
  combinedHandlingTimeCoefficient: number;
}

/** MVP konstanty pro koeficienty, které Fáze C zatím nemá odvozené z reálných
 *  dat (§10) - zdokumentované, snadno nahraditelné, až budou k dispozici
 *  kalibrační data (viz `historicalCalibrationCoefficient` komentář). */
const INTERRUPTED_CUT_COEFFICIENT = 1.15;
const INTERNAL_MACHINING_COEFFICIENT = 1.1;
const MACHINING_MODE_COEFFICIENT: Record<MachiningMode, number> = {
  roughing: 1,
  semi_finishing: 1.05,
  finishing: 1.1,
};

/**
 * `resolveCoefficients` (AP-MCE-001 Fáze C §10) - devět POJMENOVANÝCH
 * koeficientů, KAŽDÝ zvlášť se svým zdrojem/verzí/dopadem (§10: "Neslučuj je
 * do jednoho anonymního čísla"), aplikovaných na SPRÁVNOU část času:
 *  - machine/material/toolWear/interruptedCut/internalMachining/machiningMode
 *    -> `cutting_time`
 *  - complexity -> `cutting_time` I `setup_time` (§10 "complexity na setup a
 *    cutting" - dvě samostatné položky se stejnou hodnotou, jinou `appliedTo`)
 *  - operatorSkill -> `handling_time`
 *  - historicalCalibration -> `cutting_time` (výchozí 1, dokud `CalibrationProfile`
 *    neexistuje jako plný model - viz Fáze B rozsahové rozhodnutí)
 */
export function resolveTurningCoefficients(input: ResolveTurningCoefficientsInput): ResolvedTurningCoefficients {
  const complexity = input.complexityCoefficient ?? 1;
  const operatorSkill = input.operatorSkillCoefficient ?? 1;
  const toolWear = input.toolWearFactor ?? 1;
  const historicalCalibration = input.historicalCalibrationCoefficient ?? 1;
  const interruptedCut = input.interruptedCut ? INTERRUPTED_CUT_COEFFICIENT : 1;
  const internalMachining = input.internalMachining ? INTERNAL_MACHINING_COEFFICIENT : 1;
  const machiningMode = MACHINING_MODE_COEFFICIENT[input.machiningMode];

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
    {
      name: "internalMachiningCoefficient",
      value: internalMachining,
      source: input.internalMachining ? "input" : "default",
      appliedTo: "cutting_time",
    },
    { name: "machiningModeCoefficient", value: machiningMode, source: "machining_mode", appliedTo: "cutting_time" },
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
    input.machineCoefficient * input.materialCoefficient * toolWear * historicalCalibration * interruptedCut * internalMachining * machiningMode * complexity;

  return {
    contributions,
    combinedCuttingTimeCoefficient,
    combinedSetupTimeCoefficient: complexity,
    combinedHandlingTimeCoefficient: operatorSkill,
  };
}
