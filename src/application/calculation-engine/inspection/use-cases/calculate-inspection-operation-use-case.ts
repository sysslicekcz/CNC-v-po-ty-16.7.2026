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
import { InspectionOperationCalculationInput } from "../dto/inspection-operation-calculation-input";
import { InspectionCalculationContextBuilderPort } from "../inspection-calculation-context-builder";

/**
 * `CalculateInspectionOperationUseCase` (AP-MCE-001 Fáze F §17) - stejná
 * orchestrace jako `CalculateManualOperationUseCase`/Fáze C-E. Licence
 * `calculation.inspection` (§20).
 */
export class CalculateInspectionOperationUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly calculationRepository: CalculationRepository,
    private readonly materialRepository: MaterialRepository,
    private readonly contextBuilder: InspectionCalculationContextBuilderPort,
    private readonly calculationEngine: CalculationEngine,
    private readonly featureAccessService: FeatureAccessService,
    private readonly eventPublisher: DomainEventPublisher
  ) {}

  async execute(input: InspectionOperationCalculationInput): Promise<OperationCalculationOutput> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationCreate, "write");
    await this.featureAccessService.require(FeatureCodes.CalculationInspection, "write");

    const existing = await this.findExistingResultForIdempotencyKey(input.idempotencyKey, tenantId);
    if (existing) return toOperationCalculationOutput(existing);

    await this.assertReferencedEntitiesExist(input, tenantId);

    const context = await this.contextBuilder.build(input, tenantId);

    const request = CalculationRequest.create({
      id: crypto.randomUUID(),
      tenantId,
      operationCategory: "inspection",
      operationTypeId: input.operationTypeId,
      idempotencyKey: input.idempotencyKey,
      inputSnapshot: { ...input },
      ruleVersionId: context.ruleVersion.id,
      requestedAt: new Date().toISOString(),
      requestedBy: input.requestedBy,
    });
    await this.calculationRepository.saveRequest(request);
    await this.publishEvent("inspection_calculation.requested", request.id, undefined, input.actorId, input.correlationId);

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
          confidenceScore: outcome.breakdown?.inspectionDetail?.confidenceScore ?? computeConfidenceScore(outcome.issues),
          issues: this.allIssues(outcome),
          engineVersion: this.calculationEngine.engineVersion,
          strategyVersion: outcome.strategyVersion,
          ruleVersionId: context.ruleVersion.id,
          calculatedAt,
        });

    await this.calculationRepository.saveResult(result);
    await this.publishEvent(
      outcome.blocked ? "inspection_calculation.failed" : "inspection_calculation.completed",
      result.id,
      outcome.strategyVersion,
      input.actorId,
      input.correlationId
    );
    if (!outcome.blocked && outcome.breakdown?.inspectionDetail) {
      await this.publishEvent("inspection_sampling.resolved", result.id, outcome.strategyVersion, input.actorId, input.correlationId);
      if (Object.keys(context.inspectionEquipmentSnapshotsByFeatureId ?? {}).length > 0) {
        await this.publishEvent("inspection_equipment.selected", result.id, outcome.strategyVersion, input.actorId, input.correlationId);
      }
    }

    return toOperationCalculationOutput(result);
  }

  private allIssues(outcome: ReturnType<CalculationEngine["calculate"]>) {
    if (!outcome.breakdown?.inspectionDetail) return outcome.issues;
    return [...outcome.issues, ...outcome.breakdown.inspectionDetail.warnings, ...outcome.breakdown.inspectionDetail.recommendations];
  }

  private async findExistingResultForIdempotencyKey(idempotencyKey: string, tenantId: string): Promise<CalculationResult | null> {
    const existingRequest = await this.calculationRepository.findRequestByIdempotencyKey(idempotencyKey, tenantId);
    if (!existingRequest) return null;
    const [latestResult] = await this.calculationRepository.findResultsByRequestId(existingRequest.id, tenantId);
    return latestResult ?? null;
  }

  private async assertReferencedEntitiesExist(input: InspectionOperationCalculationInput, tenantId: string): Promise<void> {
    const material = await this.materialRepository.findById(input.materialId, tenantId);
    if (!material) throw MaterialError.notFound(input.materialId);
  }

  private async publishEvent(
    type:
      | "inspection_calculation.requested"
      | "inspection_calculation.completed"
      | "inspection_calculation.failed"
      | "inspection_sampling.resolved"
      | "inspection_equipment.selected",
    entityId: string,
    strategyVersion: string | undefined,
    actorId: string | undefined,
    correlationId: string | undefined
  ): Promise<void> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.eventPublisher.publish(buildCalculationEngineEvent({ type, tenantId, entityId, strategyVersion, actorId, correlationId }));
  }
}
