import { TenantContext } from "@/domain/services/tenant-context";
import { CalculationRepository } from "@/domain/calculation-engine/repositories/calculation-repository";
import { ActualTimeRecordRepository } from "@/domain/calculation-engine/repositories/actual-time-record-repository";
import { ActualTimeSegmentRepository } from "@/domain/calculation-engine/repositories/actual-time-segment-repository";
import { CalculationVarianceRepository } from "@/domain/calculation-engine/repositories/calculation-variance-repository";
import { resolveTimeOverlaps } from "@/domain/calculation-engine/calibration/time-overlap-resolver";
import { normalizeActualTime } from "@/domain/calculation-engine/calibration/actual-time-normalizer";
import { analyzeCalculationVariance, CalculationVarianceAnalysis } from "@/domain/calculation-engine/calibration/calculation-variance";
import { resolveVarianceToleranceProfile, VarianceMetric } from "@/domain/calculation-engine/calibration/variance-tolerance-profile";
import { CalculationError } from "@/domain/calculation-engine/errors/calculation-error";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { DomainEventPublisher } from "@/domain/calculation-engine/events/domain-event-publisher";
import { buildCalculationEngineEvent } from "@/domain/calculation-engine/events/build-calculation-engine-event";

const ALL_METRICS: readonly VarianceMetric[] = ["setup", "machine_time", "operator_time", "handling", "inspection", "tool_change", "unit_time", "batch_time", "total_time"];

export interface AnalyzeCalculationVarianceInput {
  calculationId: string;
  calculationRevision: number;
  actualTimeRecordId: string;
  actorId?: string;
  correlationId?: string;
}

/**
 * `AnalyzeCalculationVarianceUseCase` (AP-MCE-001 Fáze G §8/§22) - sestaví
 * `CalculationContext` pro `analyzeCalculationVariance()` (Domain, čisté):
 * načte `CalculationResult.breakdown`, normalizuje `ActualTimeRecord` (§7,
 * přes segmenty pokud existují) a vyřeší toleranční profil PRO KAŽDOU
 * metriku zvlášť (§9). Publikuje `variance.high_detected` navíc k
 * `variance.analysis_completed`, pokud aspoň jedna metrika vyšla "high"/
 * "critical" (§25).
 */
export class AnalyzeCalculationVarianceUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly calculationRepository: CalculationRepository,
    private readonly actualTimeRecordRepository: ActualTimeRecordRepository,
    private readonly segmentRepository: ActualTimeSegmentRepository,
    private readonly varianceRepository: CalculationVarianceRepository,
    private readonly featureAccessService: FeatureAccessService,
    private readonly eventPublisher: DomainEventPublisher
  ) {}

  async execute(input: AnalyzeCalculationVarianceInput): Promise<CalculationVarianceAnalysis> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationCalibrationRead, "read");

    const result = await this.calculationRepository.findResultById(input.calculationId, tenantId);
    if (!result || !result.breakdown) throw new CalculationError(`CalculationResult "${input.calculationId}" nebyl nalezen nebo nemá breakdown.`);

    const actualTimeRecord = await this.actualTimeRecordRepository.getById(input.actualTimeRecordId, tenantId);
    if (!actualTimeRecord) throw new CalculationError(`ActualTimeRecord "${input.actualTimeRecordId}" nebyl nalezen.`);

    const request = await this.calculationRepository.findRequestById(result.calculationRequestId, tenantId);
    if (!request) throw new CalculationError(`CalculationRequest "${result.calculationRequestId}" nebyl nalezen.`);

    const segments = await this.segmentRepository.listByActualTimeRecord(actualTimeRecord.id);
    const overlapResolution = segments.length > 0 ? resolveTimeOverlaps(segments) : undefined;
    const normalized = normalizeActualTime(actualTimeRecord, overlapResolution);

    const now = new Date().toISOString();
    const toleranceCandidates = await this.varianceRepository.listToleranceProfiles(tenantId);
    const toleranceByMetric = Object.fromEntries(
      ALL_METRICS.map((metric) => [
        metric,
        resolveVarianceToleranceProfile({
          candidates: toleranceCandidates,
          tenantId,
          operationCategory: request.operationCategory,
          operationSubtype: actualTimeRecord.operationSubtype,
          metric,
          now,
        }),
      ])
    ) as Record<VarianceMetric, ReturnType<typeof resolveVarianceToleranceProfile>>;

    const analysis = analyzeCalculationVariance({
      calculationId: input.calculationId,
      calculationRevision: input.calculationRevision,
      breakdown: result.breakdown,
      normalizedActualTime: normalized,
      actualToolChangeTimeMin: actualTimeRecord.toolChangeTimeMin,
      toleranceByMetric,
      now,
    });

    await this.varianceRepository.save(analysis, tenantId);
    await this.eventPublisher.publish(
      buildCalculationEngineEvent({ type: "variance.analysis_completed", tenantId, entityId: input.calculationId, actorId: input.actorId, correlationId: input.correlationId })
    );

    if (analysis.metrics.some((m) => m.comparable && (m.severity === "high" || m.severity === "critical"))) {
      await this.eventPublisher.publish(
        buildCalculationEngineEvent({ type: "variance.high_detected", tenantId, entityId: input.calculationId, actorId: input.actorId, correlationId: input.correlationId })
      );
    }

    return analysis;
  }
}
