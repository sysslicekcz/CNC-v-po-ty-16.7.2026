import { TenantContext } from "@/domain/services/tenant-context";
import { MaterialRepository } from "@/domain/repositories/material-repository";
import { MachineRepository } from "@/domain/repositories/machine-repository";
import { ToolRepository } from "@/domain/repositories/tool-repository";
import { NotFoundError } from "@/domain/errors/not-found-error";
import { MaterialError } from "@/domain/calculation-engine/errors/material-error";
import { ToolError } from "@/domain/calculation-engine/errors/tool-error";
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
import { GrindingOperationCalculationInput } from "../dto/grinding-operation-calculation-input";
import { GrindingCalculationContextBuilderPort } from "../grinding-calculation-context-builder";

/**
 * `CalculateSurfaceGrindingOperationUseCase` (AP-MCE-001 Fáze E §17) -
 * analogicky k `CalculateCylindricalGrindingOperationUseCase`, jen pro
 * ROVINNOU rodinu podtypů (`GrindingCalculationStrategy` dispatcher interně
 * vybere `SurfaceGrindingCalculationStrategy`, viz jeho komentář).
 */
export class CalculateSurfaceGrindingOperationUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly calculationRepository: CalculationRepository,
    private readonly materialRepository: MaterialRepository,
    private readonly machineRepository: MachineRepository,
    private readonly toolRepository: ToolRepository,
    private readonly contextBuilder: GrindingCalculationContextBuilderPort,
    private readonly calculationEngine: CalculationEngine,
    private readonly featureAccessService: FeatureAccessService,
    private readonly eventPublisher: DomainEventPublisher
  ) {}

  async execute(input: GrindingOperationCalculationInput): Promise<OperationCalculationOutput> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationCreate, "write");
    await this.featureAccessService.require(FeatureCodes.CalculationGrinding, "write");

    const existing = await this.findExistingResultForIdempotencyKey(input.idempotencyKey, tenantId);
    if (existing) return toOperationCalculationOutput(existing);

    await this.assertReferencedEntitiesExist(input, tenantId);

    const context = await this.contextBuilder.build(input, tenantId);

    const request = CalculationRequest.create({
      id: crypto.randomUUID(),
      tenantId,
      operationCategory: "grinding",
      operationTypeId: input.operationTypeId,
      idempotencyKey: input.idempotencyKey,
      inputSnapshot: { ...input },
      ruleVersionId: context.ruleVersion.id,
      requestedAt: new Date().toISOString(),
      requestedBy: input.requestedBy,
    });
    await this.calculationRepository.saveRequest(request);
    await this.publishEvent("grinding_calculation.requested", request.id, undefined, input.actorId, input.correlationId);

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
          confidenceScore: outcome.breakdown?.grindingDetail?.confidenceScore ?? computeConfidenceScore(outcome.issues),
          issues: this.allIssues(outcome),
          engineVersion: this.calculationEngine.engineVersion,
          strategyVersion: outcome.strategyVersion,
          ruleVersionId: context.ruleVersion.id,
          calculatedAt,
          materialProfileSnapshot: context.materialProfileSnapshot?.toJSON() as Record<string, unknown> | undefined,
          machineProfileSnapshot: context.machineProfileSnapshot?.toJSON() as Record<string, unknown> | undefined,
        });

    await this.calculationRepository.saveResult(result);
    await this.publishEvent(
      outcome.blocked ? "grinding_calculation.failed" : "grinding_calculation.completed",
      result.id,
      outcome.strategyVersion,
      input.actorId,
      input.correlationId
    );

    return toOperationCalculationOutput(result);
  }

  private allIssues(outcome: ReturnType<CalculationEngine["calculate"]>) {
    if (!outcome.breakdown?.grindingDetail) return outcome.issues;
    return [...outcome.issues, ...outcome.breakdown.grindingDetail.warnings, ...outcome.breakdown.grindingDetail.recommendations];
  }

  private async findExistingResultForIdempotencyKey(idempotencyKey: string, tenantId: string): Promise<CalculationResult | null> {
    const existingRequest = await this.calculationRepository.findRequestByIdempotencyKey(idempotencyKey, tenantId);
    if (!existingRequest) return null;
    const [latestResult] = await this.calculationRepository.findResultsByRequestId(existingRequest.id, tenantId);
    return latestResult ?? null;
  }

  private async assertReferencedEntitiesExist(input: GrindingOperationCalculationInput, tenantId: string): Promise<void> {
    const material = await this.materialRepository.findById(input.materialId, tenantId);
    if (!material) throw MaterialError.notFound(input.materialId);

    if (input.machineId) {
      const machine = await this.machineRepository.findById(input.machineId, tenantId);
      if (!machine) throw new NotFoundError("Machine", input.machineId);
    }

    for (const feature of input.features) {
      const wheelProfileId = feature.wheelProfileId ?? input.wheelProfileId;
      if (wheelProfileId) {
        const wheel = await this.toolRepository.findById(wheelProfileId, tenantId);
        if (!wheel) throw ToolError.notFound(wheelProfileId);
      }
    }
  }

  private async publishEvent(
    type: "grinding_calculation.requested" | "grinding_calculation.completed" | "grinding_calculation.failed",
    entityId: string,
    strategyVersion: string | undefined,
    actorId: string | undefined,
    correlationId: string | undefined
  ): Promise<void> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.eventPublisher.publish(buildCalculationEngineEvent({ type, tenantId, entityId, strategyVersion, actorId, correlationId }));
  }
}
