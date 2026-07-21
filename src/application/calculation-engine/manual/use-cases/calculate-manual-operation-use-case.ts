import { TenantContext } from "@/domain/services/tenant-context";
import { MaterialRepository } from "@/domain/repositories/material-repository";
import { MaterialError } from "@/domain/calculation-engine/errors/material-error";
import { CalculationRepository } from "@/domain/calculation-engine/repositories/calculation-repository";
import { CalculationEngine } from "@/domain/calculation-engine/services/calculation-engine";
import { CalculationRequest } from "@/domain/calculation-engine/entities/calculation-request";
import { CalculationResult } from "@/domain/calculation-engine/entities/calculation-result";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { DomainEventPublisher } from "@/domain/calculation-engine/events/domain-event-publisher";
import { buildCalculationEngineEvent } from "@/domain/calculation-engine/events/build-calculation-engine-event";
import { computeConfidenceScore } from "../../confidence-score";
import { toOperationCalculationOutput } from "../../mappers/calculation-result-mapper";
import { OperationCalculationOutput } from "../../dto/operation-calculation-output";
import { ManualOperationCalculationInput } from "../dto/manual-operation-calculation-input";
import { ManualOperationCalculationContextBuilderPort } from "../manual-operation-calculation-context-builder";

/**
 * `CalculateManualOperationUseCase` (AP-MCE-001 Fáze F §17) - stejná
 * orchestrace jako Fáze C/D/E `Calculate*OperationUseCase`. Licence
 * `calculation.manual` (§20 - "bez něj se strategie nesmí spustit").
 */
export class CalculateManualOperationUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly calculationRepository: CalculationRepository,
    private readonly materialRepository: MaterialRepository,
    private readonly contextBuilder: ManualOperationCalculationContextBuilderPort,
    private readonly calculationEngine: CalculationEngine,
    private readonly featureAccessService: FeatureAccessService,
    private readonly eventPublisher: DomainEventPublisher
  ) {}

  async execute(input: ManualOperationCalculationInput): Promise<OperationCalculationOutput> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationCreate, "write");
    await this.featureAccessService.require(FeatureCodes.CalculationManual, "write");

    const existing = await this.findExistingResultForIdempotencyKey(input.idempotencyKey, tenantId);
    if (existing) return toOperationCalculationOutput(existing);

    await this.assertReferencedEntitiesExist(input, tenantId);

    const context = await this.contextBuilder.build(input, tenantId);

    const request = CalculationRequest.create({
      id: crypto.randomUUID(),
      tenantId,
      operationCategory: "manual",
      operationTypeId: input.operationTypeId,
      idempotencyKey: input.idempotencyKey,
      inputSnapshot: { ...input },
      ruleVersionId: context.ruleVersion.id,
      requestedAt: new Date().toISOString(),
      requestedBy: input.requestedBy,
    });
    await this.calculationRepository.saveRequest(request);
    await this.publishEvent("manual_calculation.requested", request.id, undefined, input.actorId, input.correlationId);

    const outcome = this.calculationEngine.calculate(input, context);
    const calculatedAt = new Date().toISOString();

    const result = outcome.blocked
      ? CalculationResult.create({
          id: crypto.randomUUID(),
          tenantId,
          calculationRequestId: request.id,
          status: "failed",
          issues: outcome.issues,
          engineVersion: this.calculationEngine.engineVersion,
          strategyVersion: outcome.strategyVersion,
          ruleVersionId: context.ruleVersion.id,
          calculatedAt,
        })
      : CalculationResult.create({
          id: crypto.randomUUID(),
          tenantId,
          calculationRequestId: request.id,
          status: this.allIssues(outcome).some((issue) => issue.severity === "warning") ? "completed_with_warnings" : "completed",
          breakdown: outcome.breakdown,
          confidenceScore: outcome.breakdown?.manualDetail?.confidenceScore ?? computeConfidenceScore(outcome.issues),
          issues: this.allIssues(outcome),
          engineVersion: this.calculationEngine.engineVersion,
          strategyVersion: outcome.strategyVersion,
          ruleVersionId: context.ruleVersion.id,
          calculatedAt,
        });

    await this.calculationRepository.saveResult(result);
    await this.publishEvent(
      outcome.blocked ? "manual_calculation.failed" : "manual_calculation.completed",
      result.id,
      outcome.strategyVersion,
      input.actorId,
      input.correlationId
    );

    if (!outcome.blocked && Object.keys(context.manualTimeStandardsByFeatureId ?? {}).length > 0) {
      await this.publishEvent("manual_standard.selected", result.id, outcome.strategyVersion, input.actorId, input.correlationId);
    }

    return toOperationCalculationOutput(result);
  }

  private allIssues(outcome: ReturnType<CalculationEngine["calculate"]>) {
    if (!outcome.breakdown?.manualDetail) return outcome.issues;
    return [...outcome.issues, ...outcome.breakdown.manualDetail.warnings, ...outcome.breakdown.manualDetail.recommendations];
  }

  private async findExistingResultForIdempotencyKey(idempotencyKey: string, tenantId: string): Promise<CalculationResult | null> {
    const existingRequest = await this.calculationRepository.findRequestByIdempotencyKey(idempotencyKey, tenantId);
    if (!existingRequest) return null;
    const [latestResult] = await this.calculationRepository.findResultsByRequestId(existingRequest.id, tenantId);
    return latestResult ?? null;
  }

  private async assertReferencedEntitiesExist(input: ManualOperationCalculationInput, tenantId: string): Promise<void> {
    const material = await this.materialRepository.findById(input.materialId, tenantId);
    if (!material) throw MaterialError.notFound(input.materialId);
  }

  private async publishEvent(
    type: "manual_calculation.requested" | "manual_calculation.completed" | "manual_calculation.failed" | "manual_standard.selected",
    entityId: string,
    strategyVersion: string | undefined,
    actorId: string | undefined,
    correlationId: string | undefined
  ): Promise<void> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.eventPublisher.publish(buildCalculationEngineEvent({ type, tenantId, entityId, strategyVersion, actorId, correlationId }));
  }
}
