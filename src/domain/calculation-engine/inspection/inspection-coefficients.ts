export type InspectionCoefficientTimeBucket = "measurement" | "setup" | "handling" | "documentation" | "historical";

export interface InspectionCoefficientContribution {
  name: string;
  value: number;
  source: string;
  version?: string;
  appliedTo: InspectionCoefficientTimeBucket;
}

export interface ResolveInspectionCoefficientsInput {
  complexityCoefficient?: number;
  accuracyCoefficient?: number;
  equipmentCoefficient?: number;
  operatorSkillCoefficient?: number;
  documentationCoefficient?: number;
  automationCoefficient?: number;
  historicalCalibrationCoefficient?: number;
}

export interface ResolvedInspectionCoefficients {
  contributions: InspectionCoefficientContribution[];
  /** §10 "accuracyCoefficient na měření", "equipmentCoefficient na měření a
   *  setup", "complexityCoefficient na měření a dokumentaci",
   *  "operatorSkillCoefficient na handling, setup a manuální měření". */
  combinedMeasurementCoefficient: number;
  combinedSetupCoefficient: number;
  combinedHandlingCoefficient: number;
  combinedDocumentationCoefficient: number;
  /** §10 "calibrationCoefficient až jako schválenou historickou korekci" -
   *  aplikuje se JAKO POSLEDNÍ, na CELÝ výsledek, ne per-bucket jako
   *  ostatní čtyři výš (viz `InspectionCalculationStrategy.calculate`). */
  combinedHistoricalCoefficient: number;
}

/**
 * `resolveInspectionCoefficients` (AP-MCE-001 Fáze F §13) - SEDM POJMENOVANÝCH
 * koeficientů s vlastním zdrojem/verzí/dopadem, stejná disciplína jako
 * `resolveManualCoefficients`. Mapování na časové oblasti PŘESNĚ podle §10.
 */
export function resolveInspectionCoefficients(input: ResolveInspectionCoefficientsInput): ResolvedInspectionCoefficients {
  const complexity = input.complexityCoefficient ?? 1;
  const accuracy = input.accuracyCoefficient ?? 1;
  const equipment = input.equipmentCoefficient ?? 1;
  const operatorSkill = input.operatorSkillCoefficient ?? 1;
  const documentation = input.documentationCoefficient ?? 1;
  const automation = input.automationCoefficient ?? 1;
  const historicalCalibration = input.historicalCalibrationCoefficient ?? 1;

  const contributions: InspectionCoefficientContribution[] = [
    { name: "accuracyCoefficient", value: accuracy, source: input.accuracyCoefficient !== undefined ? "input" : "default", appliedTo: "measurement" },
    { name: "equipmentCoefficient", value: equipment, source: input.equipmentCoefficient !== undefined ? "input" : "default", appliedTo: "measurement" },
    { name: "complexityCoefficient", value: complexity, source: input.complexityCoefficient !== undefined ? "input" : "default", appliedTo: "measurement" },
    { name: "automationCoefficient", value: automation, source: input.automationCoefficient !== undefined ? "input" : "default", appliedTo: "measurement" },
    { name: "operatorSkillCoefficient", value: operatorSkill, source: input.operatorSkillCoefficient !== undefined ? "input" : "default", appliedTo: "measurement" },
    { name: "equipmentCoefficient", value: equipment, source: input.equipmentCoefficient !== undefined ? "input" : "default", appliedTo: "setup" },
    { name: "operatorSkillCoefficient", value: operatorSkill, source: input.operatorSkillCoefficient !== undefined ? "input" : "default", appliedTo: "setup" },
    { name: "operatorSkillCoefficient", value: operatorSkill, source: input.operatorSkillCoefficient !== undefined ? "input" : "default", appliedTo: "handling" },
    { name: "complexityCoefficient", value: complexity, source: input.complexityCoefficient !== undefined ? "input" : "default", appliedTo: "documentation" },
    { name: "documentationCoefficient", value: documentation, source: input.documentationCoefficient !== undefined ? "input" : "default", appliedTo: "documentation" },
    {
      name: "historicalCalibrationCoefficient",
      value: historicalCalibration,
      source: input.historicalCalibrationCoefficient !== undefined ? "calibration_profile" : "default",
      appliedTo: "historical",
    },
  ];

  return {
    contributions,
    combinedMeasurementCoefficient: accuracy * equipment * complexity * automation * operatorSkill,
    combinedSetupCoefficient: equipment * operatorSkill,
    combinedHandlingCoefficient: operatorSkill,
    combinedDocumentationCoefficient: complexity * documentation,
    combinedHistoricalCoefficient: historicalCalibration,
  };
}
