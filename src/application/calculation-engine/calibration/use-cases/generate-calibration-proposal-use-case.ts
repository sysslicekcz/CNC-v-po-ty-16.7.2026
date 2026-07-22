import { TenantContext } from "@/domain/services/tenant-context";
import { CalibrationSampleRepository } from "@/domain/calculation-engine/repositories/calibration-sample-repository";
import { CalibrationProfileRepository } from "@/domain/calculation-engine/repositories/calibration-profile-repository";
import { CalibrationProposalRepository } from "@/domain/calculation-engine/repositories/calibration-proposal-repository";
import { CalibrationProfileScope } from "@/domain/calculation-engine/calibration/calibration-profile";
import { CalibrationCoefficientTargetName } from "@/domain/calculation-engine/calibration/coefficient-target";
import { CalibrationMethod, WeightedMeanCalibrationMethod, MedianCalibrationMethod, TrimmedMeanCalibrationMethod } from "@/domain/calculation-engine/calibration/calibration-methods";
import { evaluateCalibrationSafetyRules, DEFAULT_CALIBRATION_SAFETY_THRESHOLDS } from "@/domain/calculation-engine/calibration/calibration-safety-rules";
import { median } from "@/domain/calculation-engine/calibration/calibration-outlier-detector";
import { CalibrationProposal, CalibrationPredictedImpact } from "@/domain/calculation-engine/calibration/calibration-proposal";
import { CalculationError } from "@/domain/calculation-engine/errors/calculation-error";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { DomainEventPublisher } from "@/domain/calculation-engine/events/domain-event-publisher";
import { buildCalculationEngineEvent } from "@/domain/calculation-engine/events/build-calculation-engine-event";

export type CalibrationMethodName = "weighted_mean" | "median" | "trimmed_mean";

export interface GenerateCalibrationProposalInput {
  profileScope: CalibrationProfileScope;
  targetNames: CalibrationCoefficientTargetName[];
  calibrationMethodName: CalibrationMethodName;
  trimmedMeanFraction?: number;
  minimumAllowed?: number;
  maximumAllowed?: number;
  existingProfileId?: string;
  createdBy: string;
  actorId?: string;
  correlationId?: string;
}

function buildMethod(name: CalibrationMethodName, trimmedMeanFraction?: number): CalibrationMethod {
  switch (name) {
    case "weighted_mean":
      return new WeightedMeanCalibrationMethod();
    case "median":
      return new MedianCalibrationMethod();
    case "trimmed_mean":
      return new TrimmedMeanCalibrationMethod(trimmedMeanFraction);
    default: {
      const exhaustive: never = name;
      throw new CalculationError(`Neznámá kalibrační metoda "${exhaustive}".`);
    }
  }
}

/**
 * `GenerateCalibrationProposalUseCase` (AP-MCE-001 Fáze G §15/§16/§22) -
 * vybere ZAHRNUTÉ (`included && approvedForCalibration`) vzorky tenanta,
 * spustí zvolenou `CalibrationMethod` (§15) PRO KAŽDÝ cílový koeficient
 * zvlášť (§14 "Kalibrace nesmí tvořit pouze jeden univerzální koeficient"),
 * ověří `evaluateCalibrationSafetyRules()` (§18) a uloží `CalibrationProposal`
 * se `status: "generated"` - schválení/aktivace jsou SAMOSTATNÉ use casy.
 */
export class GenerateCalibrationProposalUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly sampleRepository: CalibrationSampleRepository,
    private readonly profileRepository: CalibrationProfileRepository,
    private readonly proposalRepository: CalibrationProposalRepository,
    private readonly featureAccessService: FeatureAccessService,
    private readonly eventPublisher: DomainEventPublisher
  ) {}

  async execute(input: GenerateCalibrationProposalInput): Promise<CalibrationProposal> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationCalibrationCreate, "write");

    const allSamples = await this.sampleRepository.listByTenant(tenantId);
    const eligibleSamples = allSamples.filter((s) => s.included);
    if (eligibleSamples.length === 0) throw new CalculationError("Žádný vzorek není zahrnutý do kalibrace ('included: true').");

    const existingProfile = input.existingProfileId ? await this.profileRepository.getById(input.existingProfileId, tenantId) : null;

    const method = buildMethod(input.calibrationMethodName, input.trimmedMeanFraction);
    const currentCoefficients: Partial<Record<CalibrationCoefficientTargetName, number>> = {};
    const proposedCoefficients: Partial<Record<CalibrationCoefficientTargetName, number>> = {};
    const warningsByTarget: string[] = [];

    for (const targetName of input.targetNames) {
      const originalValue = existingProfile?.coefficientValues[targetName] ?? 1;
      const target = method.compute({
        targetName,
        originalValue,
        minimumAllowed: input.minimumAllowed ?? 0.5,
        maximumAllowed: input.maximumAllowed ?? 2,
        samples: eligibleSamples,
      });
      currentCoefficients[targetName] = originalValue;
      proposedCoefficients[targetName] = target.proposedValue;
      warningsByTarget.push(...target.warnings.map((w) => w.message));

      const machineIds = new Set(eligibleSamples.map((s) => s.machineProfileId).filter(Boolean));
      const dominantMachineFraction = machineIds.size > 0 ? Math.max(...[...machineIds].map((id) => eligibleSamples.filter((s) => s.machineProfileId === id).length)) / eligibleSamples.length : 0;
      const totalWeight = eligibleSamples.reduce((sum, s) => sum + s.sampleWeight, 0);
      const dominantSampleWeightFraction = totalWeight > 0 ? Math.max(...eligibleSamples.map((s) => s.sampleWeight)) / totalWeight : 0;

      const safetyIssues = evaluateCalibrationSafetyRules({
        sampleCount: eligibleSamples.length,
        effectiveSampleCount: target.effectiveWeight,
        originalValue,
        proposedValue: target.proposedValue,
        confidence: target.confidence,
        isGlobalOrTenantScope: input.profileScope === "global" || input.profileScope === "tenant",
        dominantSampleWeightFraction,
        dominantMachineFraction,
        mixesIncomparableOperations: new Set(eligibleSamples.map((s) => s.operationCategory)).size > 1 && input.profileScope !== "global" && input.profileScope !== "tenant",
        usesUnapprovedActualTimes: false,
        includesUnexplainedDowntimeInCuttingCoefficient: (targetName === "cuttingCoefficient" || targetName === "machineCoefficient") && eligibleSamples.some((s) => s.exclusionReason === "unexplained_critical_downtime"),
        crossTenantDataDetected: eligibleSamples.some((s) => s.tenantId !== tenantId),
        thresholds: DEFAULT_CALIBRATION_SAFETY_THRESHOLDS,
      });
      warningsByTarget.push(...safetyIssues.map((i) => i.message));
    }

    const variancePercents = eligibleSamples.map((s) => s.variancePercent);
    const sortedVariance = [...variancePercents].sort((a, b) => a - b);
    const meanVariance = variancePercents.reduce((sum, v) => sum + v, 0) / variancePercents.length;
    const varianceOfVariance = variancePercents.reduce((sum, v) => sum + (v - meanVariance) ** 2, 0) / variancePercents.length;

    const predictedImpact: CalibrationPredictedImpact = {
      sampleCount: eligibleSamples.length,
      periodFrom: eligibleSamples.reduce((min, s) => (s.createdAt < min ? s.createdAt : min), eligibleSamples[0].createdAt),
      periodTo: eligibleSamples.reduce((max, s) => (s.createdAt > max ? s.createdAt : max), eligibleSamples[0].createdAt),
      variance: varianceOfVariance,
      median: median(sortedVariance),
      mean: meanVariance,
      outlierCount: allSamples.filter((s) => !s.included).length,
      estimatedErrorReductionPercent: 0,
      risks: [...new Set(warningsByTarget)],
    };

    const now = new Date().toISOString();
    const proposal = CalibrationProposal.create({
      id: crypto.randomUUID(),
      tenantId,
      profileScope: input.profileScope,
      sourceSampleIds: eligibleSamples.map((s) => s.id),
      excludedSampleIds: allSamples.filter((s) => !s.included).map((s) => s.id),
      currentCoefficients,
      proposedCoefficients,
      predictedImpact,
      confidence: Math.min(1, eligibleSamples.reduce((sum, s) => sum + s.confidenceScore, 0) / eligibleSamples.length),
      status: "generated",
      createdBy: input.createdBy,
      createdAt: now,
      proposalVersion: 1,
    });

    await this.proposalRepository.save(proposal);
    await this.eventPublisher.publish(
      buildCalculationEngineEvent({ type: "calibration_proposal.generated", tenantId, entityId: proposal.id, actorId: input.actorId, correlationId: input.correlationId })
    );

    return proposal;
  }
}
