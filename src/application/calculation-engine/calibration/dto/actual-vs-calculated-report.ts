import type { OperationCategory } from "@/domain/calculation-engine/enums/operation-category";
import { CalculationVarianceAnalysis, VarianceMetricResult } from "@/domain/calculation-engine/calibration/calculation-variance";
import { NormalizedActualTime } from "@/domain/calculation-engine/calibration/actual-time-normalizer";
import { PredictedTimeBreakdown } from "@/domain/calculation-engine/calibration/calculation-variance";
import { VarianceCauseAssignment } from "@/domain/calculation-engine/calibration/variance-cause";
import { CalculationIssue } from "@/domain/calculation-engine/entities/types";

/**
 * `ActualVsCalculatedReport` (AP-MCE-001 Fáze G §27) - čtecí DTO pro
 * porovnání predikce/skutečnosti JEDNÉ operace, skládá dohromady výstupy
 * `AnalyzeCalculationVarianceUseCase`/`AssignVarianceCauseUseCase` do JEDNÉ
 * odpovědi pro Presentation vrstvu (mimo rozsah Fáze G, viz §32 "připravenost
 * na Fázi H").
 */
export interface ActualVsCalculatedReport {
  calculationId: string;
  calculationRevision: number;
  actualTimeRecordId: string;
  operationCategory: OperationCategory;
  operationSubtype?: string;
  machine?: string;
  material?: string;
  tool?: string;
  quantity: number;
  predicted: PredictedTimeBreakdown;
  actual: NormalizedActualTime;
  variances: VarianceMetricResult[];
  confirmedCauses: VarianceCauseAssignment[];
  suggestedCauses: VarianceCauseAssignment[];
  confidence: number;
  calibrationEligibility: { eligible: boolean; reason?: string };
  warnings: CalculationIssue[];
}

export interface BuildActualVsCalculatedReportInput {
  analysis: CalculationVarianceAnalysis;
  predicted: PredictedTimeBreakdown;
  actual: NormalizedActualTime;
  operationCategory: OperationCategory;
  operationSubtype?: string;
  machine?: string;
  material?: string;
  tool?: string;
  quantity: number;
  causeAssignments: VarianceCauseAssignment[];
  calibrationEligibility: { eligible: boolean; reason?: string };
}

/** Čistá projekce - žádné I/O, volající (use case/Presentation) už má
 *  všechna vstupní data načtená. */
export function buildActualVsCalculatedReport(input: BuildActualVsCalculatedReportInput): ActualVsCalculatedReport {
  const warnings = input.analysis.metrics.filter((m) => !m.comparable).map((m) => ({ code: "VARIANCE_NOT_COMPARABLE", severity: "information" as const, message: m.reasonIfNotComparable ?? `Metrika '${m.metric}' není porovnatelná.` }));

  return {
    calculationId: input.analysis.calculationId,
    calculationRevision: input.analysis.calculationRevision,
    actualTimeRecordId: input.analysis.actualTimeRecordId,
    operationCategory: input.operationCategory,
    operationSubtype: input.operationSubtype,
    machine: input.machine,
    material: input.material,
    tool: input.tool,
    quantity: input.quantity,
    predicted: input.predicted,
    actual: input.actual,
    variances: input.analysis.metrics,
    confirmedCauses: input.causeAssignments.filter((a) => a.status === "confirmed" || a.status === "changed" || a.status === "user_added"),
    suggestedCauses: input.causeAssignments.filter((a) => a.status === "suggested"),
    confidence: input.actual.confidenceScore,
    calibrationEligibility: input.calibrationEligibility,
    warnings,
  };
}
