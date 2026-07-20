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
import { TurningOperationCalculationInput } from "../dto/turning-operation-calculation-input";
import { TurningCalculationContextBuilderPort } from "../turning-calculation-context-builder";

export interface RecalculateTurningOperationInput extends TurningOperationCalculationInput {
  /** Id PŘEDCHOZÍHO `CalculationResult`, který se má nahradit novou revizí -
   *  MUSÍ patřit STEJNÉMU `calculationRequestId`/tenantovi (AP-MCE-001 Fáze
   *  C §15: "Recalculate musí vždy vytvořit novou revizi", "starý výsledek
   *  nesmí být přepsán"). */
  previousCalculationResultId: string;
}

/**
 * `RecalculateTurningOperationUseCase` (AP-MCE-001 Fáze C §14/§15) - na
 * rozdíl od `CalculateTurningOperationUseCase` NEKONTROLUJE idempotenci
 * (přepočet je vždy explicitní žádost, ne omylem zdvojené volání) - vždy
 * vytvoří NOVÝ `CalculationResult` se `supersedesResultId`, starý označí
 * `asSuperseded()` a ULOŽÍ OBĚ instance (§15: "starý výsledek se nikdy
 * nepřepisuje, jen se vedle něj uloží nový").
 */
export class RecalculateTurningOperationUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly calculationRepository: CalculationRepository,
    private readonly contextBuilder: TurningCalculationContextBuilderPort,
    private readonly calculationEngine: CalculationEngine,
    private readonly featureAccessService: FeatureAccessService,
    private readonly eventPublisher: DomainEventPublisher
  ) {}

  async execute(input: RecalculateTurningOperationInput): Promise<OperationCalculationOutput> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationCreate, "write");
    await this.featureAccessService.require(FeatureCodes.CalculationTurning, "write");
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
    const issues = outcome.breakdown?.turningDetail
      ? [...outcome.issues, ...outcome.breakdown.turningDetail.warnings, ...outcome.breakdown.turningDetail.recommendations]
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
          confidenceScore: outcome.breakdown?.turningDetail?.confidenceScore ?? computeConfidenceScore(outcome.issues),
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
        type: "turning_calculation.recalculated",
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
