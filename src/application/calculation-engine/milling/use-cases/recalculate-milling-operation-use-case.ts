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
import { MillingOperationCalculationInput } from "../dto/milling-operation-calculation-input";
import { MillingCalculationContextBuilderPort } from "../milling-calculation-context-builder";

export interface RecalculateMillingOperationInput extends MillingOperationCalculationInput {
  /** Id PŘEDCHOZÍHO `CalculationResult`, který se má nahradit novou revizí -
   *  stejná podmínka jako Fáze C (musí patřit STEJNÉMU tenantovi). */
  previousCalculationResultId: string;
}

/**
 * `RecalculateMillingOperationUseCase` (AP-MCE-001 Fáze D §15/§16) - stejné
 * chování jako Fáze C `RecalculateTurningOperationUseCase`: vždy vytvoří NOVÝ
 * `CalculationResult` se `supersedesResultId`, starý označí `asSuperseded()`
 * a ULOŽÍ OBĚ instance (starý výsledek se nikdy nepřepisuje).
 */
export class RecalculateMillingOperationUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly calculationRepository: CalculationRepository,
    private readonly contextBuilder: MillingCalculationContextBuilderPort,
    private readonly calculationEngine: CalculationEngine,
    private readonly featureAccessService: FeatureAccessService,
    private readonly eventPublisher: DomainEventPublisher
  ) {}

  async execute(input: RecalculateMillingOperationInput): Promise<OperationCalculationOutput> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationCreate, "write");
    await this.featureAccessService.require(FeatureCodes.CalculationMilling, "write");
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
    const issues = outcome.breakdown?.millingDetail
      ? [...outcome.issues, ...outcome.breakdown.millingDetail.warnings, ...outcome.breakdown.millingDetail.recommendations]
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
          confidenceScore: outcome.breakdown?.millingDetail?.confidenceScore ?? computeConfidenceScore(outcome.issues),
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
        type: "milling_calculation.recalculated",
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
