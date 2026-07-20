import { TenantContext } from "@/domain/services/tenant-context";
import type { OperationCategory } from "@/domain/calculation-engine/enums/operation-category";
import { CuttingConditionRepository } from "@/domain/calculation-engine/repositories/cutting-condition-repository";
import { CuttingCondition, CuttingConditionSource } from "@/domain/calculation-engine/cutting-conditions/cutting-condition";
import { CuttingConditionNotFoundError } from "@/domain/calculation-engine/errors/profile-not-found-error";
import { CrossTenantAccessError } from "@/domain/calculation-engine/errors/cross-tenant-access-error";
import { CuttingSpeed } from "@/domain/calculation-engine/value-objects/cutting-speed";
import { FeedRate } from "@/domain/calculation-engine/value-objects/feed-rate";
import { Length } from "@/domain/calculation-engine/value-objects/length";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { DomainEventPublisher } from "@/domain/calculation-engine/events/domain-event-publisher";
import { buildCalculationEngineEvent } from "@/domain/calculation-engine/events/build-calculation-engine-event";

export interface SaveCuttingConditionInput {
  /** Když je zadané, jde o ÚPRAVU existujícího záznamu (`cutting_condition.
   *  updated`), jinak se založí nový (`cutting_condition.created`). */
  id?: string;
  materialProfileId: string;
  machineProfileId?: string;
  toolProfileId?: string;
  operationCategory: OperationCategory;
  operationSubtype?: string;
  cuttingSpeed?: CuttingSpeed;
  feedPerRevolution?: FeedRate;
  feedPerTooth?: FeedRate;
  feedRate?: FeedRate;
  depthOfCut?: Length;
  widthOfCut?: Length;
  coolantMode?: string;
  source: CuttingConditionSource;
  priority?: number;
  confidence: number;
  ruleVersion: string;
  validFrom: string;
  validTo?: string;
  actorId?: string;
  correlationId?: string;
}

/**
 * `SaveCuttingConditionUseCase` (AP-MCE-001 Fáze B §5/§13) - jediné místo,
 * které skutečně PERZISTUJE `CuttingCondition` (typicky tenant schvalující
 * vlastní podmínku, `source: "tenant_approved"` - úroveň 2 §5). `Resolve
 * CuttingConditionsUseCase` je čistě čtecí a tenhle zápis nikdy nevolá.
 * Vyžaduje `calculation.admin` (§12 - správa podmínek, ne jejich použití).
 */
export class SaveCuttingConditionUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly repository: CuttingConditionRepository,
    private readonly featureAccessService: FeatureAccessService,
    private readonly eventPublisher: DomainEventPublisher
  ) {}

  async execute(input: SaveCuttingConditionInput): Promise<Record<string, unknown>> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationAdmin, "write");

    const existing = input.id ? await this.repository.getById(input.id, tenantId) : null;
    if (input.id && !existing) throw new CuttingConditionNotFoundError(input.id, tenantId);
    if (existing && existing.tenantId !== tenantId) throw new CrossTenantAccessError("CuttingCondition", input.id!, tenantId);

    const condition = CuttingCondition.create({
      id: existing?.id ?? crypto.randomUUID(),
      tenantId,
      materialProfileId: input.materialProfileId,
      machineProfileId: input.machineProfileId,
      toolProfileId: input.toolProfileId,
      operationCategory: input.operationCategory,
      operationSubtype: input.operationSubtype,
      cuttingSpeed: input.cuttingSpeed,
      feedPerRevolution: input.feedPerRevolution,
      feedPerTooth: input.feedPerTooth,
      feedRate: input.feedRate,
      depthOfCut: input.depthOfCut,
      widthOfCut: input.widthOfCut,
      coolantMode: input.coolantMode,
      source: input.source,
      priority: input.priority ?? 0,
      confidence: input.confidence,
      ruleVersion: input.ruleVersion,
      validFrom: input.validFrom,
      validTo: input.validTo,
    });

    await this.repository.save(condition);

    const now = new Date().toISOString();
    await this.eventPublisher.publish(
      buildCalculationEngineEvent({
        type: existing ? "cutting_condition.updated" : "cutting_condition.created",
        tenantId,
        entityId: condition.id,
        actorId: input.actorId,
        correlationId: input.correlationId,
        occurredAt: now,
      })
    );

    return {
      id: condition.id,
      tenantId: condition.tenantId,
      materialProfileId: condition.materialProfileId,
      machineProfileId: condition.machineProfileId,
      toolProfileId: condition.toolProfileId,
      operationCategory: condition.operationCategory,
      operationSubtype: condition.operationSubtype,
      source: condition.source,
      priority: condition.priority,
      confidence: condition.confidence,
      ruleVersion: condition.ruleVersion,
      validFrom: condition.validFrom,
      validTo: condition.validTo,
    };
  }
}
