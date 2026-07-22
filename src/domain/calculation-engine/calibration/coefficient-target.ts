import { CalculationIssue } from "../entities/types";
import { calibrationIssue } from "./calibration-issue-codes";

/** AP-MCE-001 Fáze G §14 - patnáct samostatných kalibračních cílů. Kalibrace
 *  NIKDY netvoří jeden univerzální koeficient (§14 explicitně) - každá
 *  technologická oblast (soustružení/frézování/broušení/ruční operace/
 *  kontrola) má svůj VLASTNÍ cíl, stejná disciplína jako Fáze C-F "Nepoužívej
 *  anonymní souhrnný koeficient". */
export type CalibrationCoefficientTargetName =
  | "setupCoefficient"
  | "cuttingCoefficient"
  | "machineCoefficient"
  | "materialCoefficient"
  | "toolWearCoefficient"
  | "handlingCoefficient"
  | "inspectionCoefficient"
  | "manualOperationCoefficient"
  | "operatorAttendanceCoefficient"
  | "pathApproximationCoefficient"
  | "threeDApproximationCoefficient"
  | "grindingCoefficient"
  | "dressingCoefficient"
  | "samplingCoefficient"
  | "historicalCalibrationCoefficient";

export interface CoefficientTarget {
  name: CalibrationCoefficientTargetName;
  originalValue: number;
  proposedValue: number;
  minimumAllowed: number;
  maximumAllowed: number;
  sampleCount: number;
  effectiveWeight: number;
  confidence: number;
  warnings: CalculationIssue[];
}

/**
 * Ověří JEDEN `CoefficientTarget` proti jeho vlastnímu rozsahu (§14) - vrátí
 * `CALIBRATION_COEFFICIENT_OUT_OF_RANGE`, pokud `proposedValue` leží mimo
 * `[minimumAllowed, maximumAllowed]` (maximální ZMĚNA na jednu verzi řeší
 * `calibration-safety-rules.ts`, §18 - tohle je jen statický rozsah cíle).
 */
export function validateCoefficientTargetRange(target: CoefficientTarget): CalculationIssue[] {
  const issues: CalculationIssue[] = [];
  if (target.proposedValue < target.minimumAllowed || target.proposedValue > target.maximumAllowed) {
    issues.push(
      calibrationIssue(
        "CALIBRATION_COEFFICIENT_OUT_OF_RANGE",
        `'${target.name}': navržená hodnota ${target.proposedValue} je mimo povolený rozsah [${target.minimumAllowed}, ${target.maximumAllowed}].`,
        target.name
      )
    );
  }
  return issues;
}
