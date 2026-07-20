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
import { TurningOperationCalculationInput } from "../dto/turning-operation-calculation-input";
import { TurningCalculationContextBuilder } from "../turning-calculation-context-builder";

/**
 * `CalculateTurningOperationUseCase` (AP-MCE-001 Fáze C §14) - stejná
 * orchestrace jako Fáze A `CalculateOperationUseCase` (existenční kontroly,
 * idempotence, uložení request/result), jen s bohatším vstupem/kontextem
 * (`TurningCalculationContextBuilder`, §6) a licencí navíc (`calculation.
 * turning`, §17 - "bez něj se strategie nesmí spustit", kontrola tady, NE
 * jen v UI).
 */
export class CalculateTurningOperationUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly calculationRepository: CalculationRepository,
    private readonly materialRepository: MaterialRepository,
    private readonly machineRepository: MachineRepository,
    private readonly toolRepository: ToolRepository,
    private readonly contextBuilder: TurningCalculationContextBuilder,
    private readonly calculationEngine: CalculationEngine,
    private readonly featureAccessService: FeatureAccessService,
    private readonly eventPublisher: DomainEventPublisher
  ) {}

  async execute(input: TurningOperationCalculationInput): Promise<OperationCalculationOutput> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationCreate, "write");
    await this.featureAccessService.require(FeatureCodes.CalculationTurning, "write");

    const existing = await this.findExistingResultForIdempotencyKey(input.idempotencyKey, tenantId);
    if (existing) return toOperationCalculationOutput(existing);

    await this.assertReferencedEntitiesExist(input, tenantId);

    const context = await this.contextBuilder.build(input, tenantId);

    const request = CalculationRequest.create({
      id: crypto.randomUUID(),
      tenantId,
      operationCategory: "turning",
      operationTypeId: input.operationTypeId,
      idempotencyKey: input.idempotencyKey,
      inputSnapshot: { ...input },
      ruleVersionId: context.ruleVersion.id,
      requestedAt: new Date().toISOString(),
      requestedBy: input.requestedBy,
    });
    await this.calculationRepository.saveRequest(request);
    await this.publishEvent("turning_calculation.requested", request.id, undefined, input.actorId, input.correlationId);

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
          confidenceScore: outcome.breakdown?.turningDetail?.confidenceScore ?? computeConfidenceScore(outcome.issues),
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
      outcome.blocked ? "turning_calculation.failed" : "turning_calculation.completed",
      result.id,
      outcome.strategyVersion,
      input.actorId,
      input.correlationId
    );

    return toOperationCalculationOutput(result);
  }

  /** Sloučí `validate()` issues (`outcome.issues`) s nezávaznými nálezy
   *  objevenými až během `calculate()` (`breakdown.turningDetail.warnings/
   *  recommendations`) - viz `TurningCalculationStrategy` komentář, proč
   *  tahle dvě místa existují a musí se tu spojit do JEDNOHO `CalculationResult.
   *  issues`, na které je zbytek appky zvyklý spoléhat. */
  private allIssues(outcome: ReturnType<CalculationEngine["calculate"]>) {
    if (!outcome.breakdown?.turningDetail) return outcome.issues;
    return [...outcome.issues, ...outcome.breakdown.turningDetail.warnings, ...outcome.breakdown.turningDetail.recommendations];
  }

  private async findExistingResultForIdempotencyKey(idempotencyKey: string, tenantId: string): Promise<CalculationResult | null> {
    const existingRequest = await this.calculationRepository.findRequestByIdempotencyKey(idempotencyKey, tenantId);
    if (!existingRequest) return null;
    const [latestResult] = await this.calculationRepository.findResultsByRequestId(existingRequest.id, tenantId);
    return latestResult ?? null;
  }

  private async assertReferencedEntitiesExist(input: TurningOperationCalculationInput, tenantId: string): Promise<void> {
    const material = await this.materialRepository.findById(input.materialId, tenantId);
    if (!material) throw MaterialError.notFound(input.materialId);

    if (input.machineId) {
      const machine = await this.machineRepository.findById(input.machineId, tenantId);
      if (!machine) throw new NotFoundError("Machine", input.machineId);
    }

    for (const feature of input.features) {
      if (feature.toolProfileId) {
        const tool = await this.toolRepository.findById(feature.toolProfileId, tenantId);
        if (!tool) throw ToolError.notFound(feature.toolProfileId);
      }
    }
  }

  private async publishEvent(
    type: "turning_calculation.requested" | "turning_calculation.completed" | "turning_calculation.failed",
    entityId: string,
    strategyVersion: string | undefined,
    actorId: string | undefined,
    correlationId: string | undefined
  ): Promise<void> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.eventPublisher.publish(
      buildCalculationEngineEvent({ type, tenantId, entityId, strategyVersion, actorId, correlationId })
    );
  }
}
