import type { CalibrationProfileScope } from "@/domain/calculation-engine/calibration/calibration-profile";
import type { CalibrationCoefficientTargetName } from "@/domain/calculation-engine/calibration/coefficient-target";
import type { CalibrationBacktestResult, SubgroupStability } from "@/domain/calculation-engine/calibration/calibration-backtest-service";
import type { CalibrationProposal } from "@/domain/calculation-engine/calibration/calibration-proposal";

export type CalibrationImpactRecommendation = "approve" | "reject" | "needs_more_data" | "needs_review";

export interface CalibrationSubgroupImpact {
  dimension: "machine" | "material" | "operation_category";
  groups: readonly SubgroupStability[];
}

/**
 * `CalibrationImpactReport` (AP-MCE-001 Fáze G §27) - čtecí DTO shrnující
 * dopad JEDNOHO kalibračního návrhu/profilu napříč všemi cílovými koeficienty
 * (na rozdíl od `CalibrationBacktestResult`, který je vždy PER-target) -
 * skládá dohromady `CalibrationProposal.predictedImpact` +
 * `CalibrationProposal.validationResult` + `runCalibrationBacktest()` výstupy
 * pro Presentation vrstvu (mimo rozsah Fáze G, viz §32 "připravenost na
 * Fázi H").
 */
export interface CalibrationImpactReport {
  profileId: string;
  profileVersion: number;
  scope: CalibrationProfileScope;
  sampleCount: number;
  period: { from: string; to: string };
  coefficientsBefore: Readonly<Partial<Record<CalibrationCoefficientTargetName, number>>>;
  coefficientsAfter: Readonly<Partial<Record<CalibrationCoefficientTargetName, number>>>;
  errorBeforeMin: number;
  errorAfterMin: number;
  improvedSampleCount: number;
  worsenedSampleCount: number;
  subgroupImpact: readonly CalibrationSubgroupImpact[];
  risks: readonly string[];
  recommendation: CalibrationImpactRecommendation;
}

export interface BuildCalibrationImpactReportInput {
  proposal: CalibrationProposal;
  /** ID zdrojového profilu, který návrh mění (`ActivateCalibrationProfileUseCase`
   *  ho zatím nemusí znát dopředu - proto je to samostatný vstup, ne
   *  `proposal.id`). */
  profileId: string;
  profileVersion: number;
  backtestResults: readonly CalibrationBacktestResult[];
}

function deriveRecommendation(proposal: CalibrationProposal, backtestResults: readonly CalibrationBacktestResult[]): CalibrationImpactRecommendation {
  if (proposal.predictedImpact.sampleCount < 10) return "needs_more_data";
  if (backtestResults.length === 0) return "needs_review";
  if (backtestResults.every((r) => r.passed)) return "approve";
  return "reject";
}

/** Čistá projekce - žádné I/O, volající (use case/Presentation) už má
 *  všechna vstupní data načtená (`proposal` + backtest výstupy z `Backtest
 *  CalibrationProposalUseCase`). */
export function buildCalibrationImpactReport(input: BuildCalibrationImpactReportInput): CalibrationImpactReport {
  const { proposal, backtestResults } = input;

  const errorBeforeMin = backtestResults.reduce((worst, r) => Math.max(worst, r.maeBeforeMin), 0);
  const errorAfterMin = backtestResults.reduce((worst, r) => Math.max(worst, r.maeAfterMin), 0);
  const improvedSampleCount = backtestResults.reduce((sum, r) => sum + r.improvedSampleCount, 0);
  const worsenedSampleCount = backtestResults.reduce((sum, r) => sum + r.worsenedSampleCount, 0);

  const subgroupImpact: CalibrationSubgroupImpact[] = [
    { dimension: "machine", groups: backtestResults.flatMap((r) => r.stabilityByMachine) },
    { dimension: "material", groups: backtestResults.flatMap((r) => r.stabilityByMaterial) },
    { dimension: "operation_category", groups: backtestResults.flatMap((r) => r.stabilityByOperationCategory) },
  ];

  return {
    profileId: input.profileId,
    profileVersion: input.profileVersion,
    scope: proposal.profileScope,
    sampleCount: proposal.predictedImpact.sampleCount,
    period: { from: proposal.predictedImpact.periodFrom, to: proposal.predictedImpact.periodTo },
    coefficientsBefore: proposal.currentCoefficients,
    coefficientsAfter: proposal.proposedCoefficients,
    errorBeforeMin,
    errorAfterMin,
    improvedSampleCount,
    worsenedSampleCount,
    subgroupImpact,
    risks: proposal.predictedImpact.risks,
    recommendation: deriveRecommendation(proposal, backtestResults),
  };
}
