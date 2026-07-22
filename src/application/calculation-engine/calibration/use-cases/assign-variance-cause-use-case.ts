import { TenantContext } from "@/domain/services/tenant-context";
import { CalculationVarianceRepository } from "@/domain/calculation-engine/repositories/calculation-variance-repository";
import { ActualTimeRecordRepository } from "@/domain/calculation-engine/repositories/actual-time-record-repository";
import { VarianceCauseRepository } from "@/domain/calculation-engine/repositories/variance-cause-repository";
import { classifyVarianceCauses } from "@/domain/calculation-engine/calibration/variance-cause-classifier";
import { VarianceCauseAssignment } from "@/domain/calculation-engine/calibration/variance-cause";
import { CalculationError } from "@/domain/calculation-engine/errors/calculation-error";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { DomainEventPublisher } from "@/domain/calculation-engine/events/domain-event-publisher";
import { buildCalculationEngineEvent } from "@/domain/calculation-engine/events/build-calculation-engine-event";

export interface AssignVarianceCauseInput {
  calculationId: string;
  calculationRevision: number;
  actualTimeRecordId: string;
  actorId?: string;
  correlationId?: string;
}

/**
 * `AssignVarianceCauseUseCase` (AP-MCE-001 Fáze G §10/§22) - zavolá
 * `classifyVarianceCauses()` (Domain, čisté pravidlo) nad uloženou
 * `CalculationVarianceAnalysis` a uloží KAŽDÝ návrh jako samostatný
 * `VarianceCauseAssignment` se `status: "suggested"` - uživatel je pak
 * potvrdí/odmítne přes `ConfirmVarianceCauseUseCase`/`RejectVarianceCause
 * UseCase` (§10 "Uživatel musí mít možnost příčinu potvrdit/odmítnout/
 * změnit/doplnit").
 */
export class AssignVarianceCauseUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly varianceRepository: CalculationVarianceRepository,
    private readonly actualTimeRecordRepository: ActualTimeRecordRepository,
    private readonly varianceCauseRepository: VarianceCauseRepository,
    private readonly featureAccessService: FeatureAccessService,
    private readonly eventPublisher: DomainEventPublisher
  ) {}

  async execute(input: AssignVarianceCauseInput): Promise<VarianceCauseAssignment[]> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationCalibrationRead, "read");

    const analysis = await this.varianceRepository.getByCalculation(input.calculationId, input.calculationRevision, tenantId);
    if (!analysis) throw new CalculationError(`CalculationVarianceAnalysis pro "${input.calculationId}"@${input.calculationRevision} nebyla nalezena.`);

    const actualTimeRecord = await this.actualTimeRecordRepository.getById(input.actualTimeRecordId, tenantId);
    if (!actualTimeRecord) throw new CalculationError(`ActualTimeRecord "${input.actualTimeRecordId}" nebyl nalezen.`);

    const batchTimeMetric = analysis.metrics.find((m) => m.metric === "batch_time");
    const suggestions = classifyVarianceCauses(analysis, {
      operationCategory: actualTimeRecord.operationCategory,
      waitingTimeMin: actualTimeRecord.waitingTimeMin ?? 0,
      downtimeMin: actualTimeRecord.downtimeMin ?? 0,
      reworkTimeMin: actualTimeRecord.reworkTimeMin ?? 0,
      batchTimeMin: batchTimeMetric?.actualValueMin ?? 0,
    });

    const now = new Date().toISOString();
    const assignments = suggestions.map((suggestion) =>
      VarianceCauseAssignment.create({
        id: crypto.randomUUID(),
        tenantId,
        calculationId: input.calculationId,
        calculationRevision: input.calculationRevision,
        actualTimeRecordId: input.actualTimeRecordId,
        causeCode: suggestion.causeCode,
        confidence: suggestion.confidence,
        evidence: suggestion.evidence,
        affectedMetrics: suggestion.affectedMetrics,
        recommendation: suggestion.recommendation,
        classificationVersion: suggestion.classificationVersion,
        status: "suggested",
        createdAt: now,
        updatedAt: now,
      })
    );

    await this.varianceCauseRepository.saveMany(assignments);
    await this.eventPublisher.publish(
      buildCalculationEngineEvent({ type: "variance_cause.suggested", tenantId, entityId: input.calculationId, actorId: input.actorId, correlationId: input.correlationId })
    );

    return assignments;
  }
}
