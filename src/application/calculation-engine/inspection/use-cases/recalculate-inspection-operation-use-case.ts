import { TenantContext } from "@/domain/services/tenant-context";
import { CalculationRepository } from "@/domain/calculation-engine/repositories/calculation-repository";
import { CalculationEngine } from "@/domain/calculation-engine/services/calculation-engine";
import { CalculationResult } from "@/domain/calculation-engine/entities/calculation-result";
import { CalculationError } from "@/domain/calculation-engine/errors/calculation-error";
import { CrossTenantAccessError } from "@/domain/calculation-engine/errors/cross-tenant-access-error";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { DomainEventPublisher } from "@/domain/calculation-engine/events/domain-event-publisher";
import { buildCalculationEngineEvent } from "@/domain/calculation-engine/events/build-calculation-engine-event";
import { computeConfidenceScore } from "../../confidence-score";
import { toOperationCalculationOutput } from "../../mappers/calculation-result-mapper";
import { OperationCalculationOutput } from "../../dto/operation-calculation-output";
import { InspectionOperationCalculationInput } from "../dto/inspection-operation-calculation-input";
import { InspectionCalculationContextBuilderPort } from "../inspection-calculation-context-builder";

export interface RecalculateInspectionOperationInput extends InspectionOperationCalculationInput {
  previousCalculationResultId: string;
}

/**
 * `RecalculateInspectionOperationUseCase` (AP-MCE-001 Fáze F §17) - stejná
 * disciplína jako `RecalculateManualOperationUseCase` (nová revize, publikuje
 * `inspection_calculation.recalculated`).
 */
export class RecalculateInspectionOperationUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly calculationRepository: CalculationRepository,
    private readonly contextBuilder: InspectionCalculationContextBuilderPort,
    private readonly calculationEngine: CalculationEngine,
    private readonly featureAccessService: FeatureAccessService,
    private readonly eventPublisher: DomainEventPublisher
  ) {}

  async execute(input: RecalculateInspectionOperationInput): Promise<OperationCalculationOutput> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationCreate, "write");
    await this.featureAccessService.require(FeatureCodes.CalculationInspection, "write");
    await this.featureAccessService.require(FeatureCodes.CalculationOverride, "write");

    const previousResult = await this.calculationRepository.findResultById(input.previousCalculationResultId, tenantId);
    if (!previousResult) {
      throw new CalculationError(`CalculationResult "${input.previousCalculationResultId}" nebyl nalezen.`);
    }
    if (previousResult.tenantId !== tenantId) {
      throw new CrossTenantAccessError("CalculationResult", input.previousCalculationResultId, tenantId);
    }

    const context = await this.contextBuilder.build(input, tenantId);
    const outcome = this.calculationEngine.calculate(input, context);
    const calculatedAt = new Date().toISOString();
    const issues = outcome.breakdown?.inspectionDetail
      ? [...outcome.issues, ...outcome.breakdown.inspectionDetail.warnings, ...outcome.breakdown.inspectionDetail.recommendations]
      : outcome.issues;

    const newResult = outcome.blocked
      ? CalculationResult.create({
          id: crypto.randomUUID(),
          tenantId,
          calculationRequestId: previousResult.calculationRequestId,
          status: "failed",
          issues,
          engineVersion: this.calculationEngine.engineVersion,
          strategyVersion: outcome.strategyVersion,
          ruleVersionId: context.ruleVersion.id,
          calculatedAt,
          supersedesResultId: previousResult.id,
        })
      : CalculationResult.create({
          id: crypto.randomUUID(),
          tenantId,
          calculationRequestId: previousResult.calculationRequestId,
          status: issues.some((issue) => issue.severity === "warning") ? "completed_with_warnings" : "completed",
          breakdown: outcome.breakdown,
          confidenceScore: outcome.breakdown?.inspectionDetail?.confidenceScore ?? computeConfidenceScore(outcome.issues),
          issues,
          engineVersion: this.calculationEngine.engineVersion,
          strategyVersion: outcome.strategyVersion,
          ruleVersionId: context.ruleVersion.id,
          calculatedAt,
          supersedesResultId: previousResult.id,
        });

    await this.calculationRepository.saveResult(previousResult.asSuperseded());
    await this.calculationRepository.saveResult(newResult);
    await this.eventPublisher.publish(
      buildCalculationEngineEvent({
        type: "inspection_calculation.recalculated",
        tenantId,
        entityId: newResult.id,
        strategyVersion: outcome.strategyVersion,
        actorId: input.actorId,
        correlationId: input.correlationId,
      })
    );

    return toOperationCalculationOutput(newResult);
  }
}
