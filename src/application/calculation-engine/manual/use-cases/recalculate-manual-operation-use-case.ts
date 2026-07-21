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
import { ManualOperationCalculationInput } from "../dto/manual-operation-calculation-input";
import { ManualOperationCalculationContextBuilderPort } from "../manual-operation-calculation-context-builder";

export interface RecalculateManualOperationInput extends ManualOperationCalculationInput {
  /** Id PŘEDCHOZÍHO `CalculationResult`, který se má nahradit novou revizí -
   *  stejná disciplína jako Fáze C/D/E `RecalculateXOperationInput`. */
  previousCalculationResultId: string;
}

/**
 * `RecalculateManualOperationUseCase` (AP-MCE-001 Fáze F §17) - stejná
 * disciplína jako Fáze C/D/E: vždy nová revize (`supersedesResultId`), starý
 * výsledek se nikdy nepřepisuje, publikuje `manual_calculation.recalculated`
 * (§19) bez ohledu na to, jestli přepočet skončil `blocked` (stejný vzor jako
 * `RecalculateTurningOperationUseCase`).
 */
export class RecalculateManualOperationUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly calculationRepository: CalculationRepository,
    private readonly contextBuilder: ManualOperationCalculationContextBuilderPort,
    private readonly calculationEngine: CalculationEngine,
    private readonly featureAccessService: FeatureAccessService,
    private readonly eventPublisher: DomainEventPublisher
  ) {}

  async execute(input: RecalculateManualOperationInput): Promise<OperationCalculationOutput> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationCreate, "write");
    await this.featureAccessService.require(FeatureCodes.CalculationManual, "write");
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
    const issues = outcome.breakdown?.manualDetail
      ? [...outcome.issues, ...outcome.breakdown.manualDetail.warnings, ...outcome.breakdown.manualDetail.recommendations]
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
          confidenceScore: outcome.breakdown?.manualDetail?.confidenceScore ?? computeConfidenceScore(outcome.issues),
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
        type: "manual_calculation.recalculated",
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
