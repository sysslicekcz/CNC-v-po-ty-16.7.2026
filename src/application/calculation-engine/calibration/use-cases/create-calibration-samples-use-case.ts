import { TenantContext } from "@/domain/services/tenant-context";
import { CalculationRepository } from "@/domain/calculation-engine/repositories/calculation-repository";
import { ActualTimeRecordRepository } from "@/domain/calculation-engine/repositories/actual-time-record-repository";
import { CalibrationSampleRepository } from "@/domain/calculation-engine/repositories/calibration-sample-repository";
import { CalibrationSample } from "@/domain/calculation-engine/calibration/calibration-sample";
import { evaluateCalibrationSampleEligibility } from "@/domain/calculation-engine/calibration/calibration-sample";
import { CalculationError } from "@/domain/calculation-engine/errors/calculation-error";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { DomainEventPublisher } from "@/domain/calculation-engine/events/domain-event-publisher";
import { buildCalculationEngineEvent } from "@/domain/calculation-engine/events/build-calculation-engine-event";

export interface CreateCalibrationSampleCandidate {
  calculationId: string;
  calculationRevision: number;
  actualTimeRecordId: string;
  matchConfidence: number;
  machineProfileId?: string;
  materialProfileId?: string;
  toolProfileIds?: string[];
  isReworkProperlyMarked?: boolean;
  operationChangedVsCalculatedProcedure?: boolean;
  sampleWeight?: number;
}

export interface CreateCalibrationSamplesInput {
  candidates: CreateCalibrationSampleCandidate[];
  actorId?: string;
  correlationId?: string;
}

/**
 * `CreateCalibrationSamplesUseCase` (AP-MCE-001 Fáze G §11/§22) - pro KAŽDÝ
 * kandidát (už spárovaný `ActualTimeRecord` <-> `CalculationResult`, viz
 * `MatchActualTimeToCalculationUseCase`) vyhodnotí `evaluateCalibrationSample
 * Eligibility()` (§11 osm podmínek) a vytvoří `CalibrationSample` - vyřazené
 * vzorky se ULOŽÍ TAKY (`included: false`), ne zahodí, aby zůstala auditní
 * stopa PROČ se do kalibrace nepočítaly.
 */
export class CreateCalibrationSamplesUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly calculationRepository: CalculationRepository,
    private readonly actualTimeRecordRepository: ActualTimeRecordRepository,
    private readonly calibrationSampleRepository: CalibrationSampleRepository,
    private readonly featureAccessService: FeatureAccessService,
    private readonly eventPublisher: DomainEventPublisher
  ) {}

  async execute(input: CreateCalibrationSamplesInput): Promise<CalibrationSample[]> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationCalibrationCreate, "write");

    const now = new Date().toISOString();
    const samples: CalibrationSample[] = [];

    for (const candidate of input.candidates) {
      const result = await this.calculationRepository.findResultById(candidate.calculationId, tenantId);
      if (!result || !result.breakdown) throw new CalculationError(`CalculationResult "${candidate.calculationId}" nebyl nalezen nebo nemá breakdown.`);

      const actualTimeRecord = await this.actualTimeRecordRepository.getById(candidate.actualTimeRecordId, tenantId);
      if (!actualTimeRecord) throw new CalculationError(`ActualTimeRecord "${candidate.actualTimeRecordId}" nebyl nalezen.`);

      const request = await this.calculationRepository.findRequestById(result.calculationRequestId, tenantId);
      if (!request) throw new CalculationError(`CalculationRequest "${result.calculationRequestId}" nebyl nalezen.`);

      const predictedTimeMin = result.breakdown.totalOperationTime.minutes;
      const actualTimeMin = actualTimeRecord.totalElapsedTimeMin ?? 0;
      const hasCompleteData = actualTimeRecord.totalElapsedTimeMin !== undefined && actualTimeRecord.quantityCompleted > 0;
      const hasCriticalUnexplainedDowntime = (actualTimeRecord.downtimeMin ?? 0) > 0 && !actualTimeRecord.notes;

      const eligibility = evaluateCalibrationSampleEligibility({
        matchConfidence: candidate.matchConfidence,
        actualTimeApproved: actualTimeRecord.isApproved,
        hasCompleteData,
        hasCriticalUnexplainedDowntime,
        quantity: actualTimeRecord.quantityCompleted,
        isReworkProperlyMarked: candidate.isReworkProperlyMarked ?? true,
        resultConfidenceScore: result.confidenceScore ?? 0,
        operationChangedVsCalculatedProcedure: candidate.operationChangedVsCalculatedProcedure ?? false,
      });

      const sample = CalibrationSample.create({
        id: crypto.randomUUID(),
        tenantId,
        calculationId: candidate.calculationId,
        calculationRevision: candidate.calculationRevision,
        actualTimeRecordId: candidate.actualTimeRecordId,
        operationCategory: request.operationCategory,
        operationSubtype: actualTimeRecord.operationSubtype,
        machineProfileId: candidate.machineProfileId,
        materialProfileId: candidate.materialProfileId,
        toolProfileIds: candidate.toolProfileIds ?? [],
        workstationId: actualTimeRecord.workstationId,
        predictedTimeMin,
        actualTimeMin,
        variancePercent: predictedTimeMin > 0 ? ((actualTimeMin - predictedTimeMin) / predictedTimeMin) * 100 : 0,
        quantity: actualTimeRecord.quantityCompleted,
        confidenceScore: Math.min(candidate.matchConfidence, result.confidenceScore ?? 0),
        included: eligibility.included,
        exclusionReason: eligibility.exclusionReason,
        approvedForCalibration: false,
        rootCauseAssignments: [],
        sampleWeight: candidate.sampleWeight ?? 1,
        createdAt: now,
      });
      samples.push(sample);
    }

    await this.calibrationSampleRepository.saveMany(samples);
    await this.eventPublisher.publish(
      buildCalculationEngineEvent({ type: "calibration_samples.created", tenantId, entityId: crypto.randomUUID(), actorId: input.actorId, correlationId: input.correlationId })
    );

    return samples;
  }
}
