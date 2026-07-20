import { TenantContext } from "@/domain/services/tenant-context";
import { ToolRepository } from "@/domain/repositories/tool-repository";
import { ToolTypeRepository } from "@/domain/repositories/tool-type-repository";
import { NotFoundError } from "@/domain/errors/not-found-error";
import { ToolError } from "@/domain/calculation-engine/errors/tool-error";
import { ToolProfileRepository } from "@/domain/calculation-engine/repositories/tool-profile-repository";
import { ToolProfileFactory } from "@/domain/calculation-engine/profiles/tool-profile-factory";
import { ToolLifeProfile } from "@/domain/calculation-engine/profiles/tool-life-profile";
import { ToolWearCurve } from "@/domain/calculation-engine/profiles/tool-wear-curve";
import type { OperationCategory } from "@/domain/calculation-engine/enums/operation-category";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { DomainEventPublisher } from "@/domain/calculation-engine/events/domain-event-publisher";
import { buildCalculationEngineEvent } from "@/domain/calculation-engine/events/build-calculation-engine-event";

export interface CreateToolProfileInput {
  toolId: string;
  siteId?: string;
  toolMaterial?: string;
  geometry?: string;
  suitableMaterialGroupIds?: readonly string[];
  supportedOperationCategories?: readonly OperationCategory[];
  toolLife?: ToolLifeProfile;
  toolChangeTimeSec?: number;
  price?: number;
  currency?: string;
  wearFactorCurve?: ToolWearCurve;
  actorId?: string;
  correlationId?: string;
}

/** `CreateToolProfileUseCase` (AP-MCE-001 Fáze B §11) - založí kalkulační
 *  `ToolProfile` z už existujícího `Tool` master-data záznamu. Vyžaduje
 *  `calculation.admin` (§12). */
export class CreateToolProfileUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly toolRepository: ToolRepository,
    private readonly toolTypeRepository: ToolTypeRepository,
    private readonly toolProfileRepository: ToolProfileRepository,
    private readonly featureAccessService: FeatureAccessService,
    private readonly eventPublisher: DomainEventPublisher
  ) {}

  async execute(input: CreateToolProfileInput): Promise<Record<string, unknown>> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationAdmin, "write");

    const tool = await this.toolRepository.findById(input.toolId, tenantId);
    if (!tool) throw ToolError.notFound(input.toolId);

    const toolType = await this.toolTypeRepository.findById(tool.toolTypeId, tenantId);
    if (!toolType) throw new NotFoundError("ToolType", tool.toolTypeId);

    const now = new Date().toISOString();
    const profile = ToolProfileFactory.createFromTool({
      tool,
      toolType,
      siteId: input.siteId,
      toolMaterial: input.toolMaterial,
      geometry: input.geometry,
      suitableMaterialGroupIds: input.suitableMaterialGroupIds,
      supportedOperationCategories: input.supportedOperationCategories,
      toolLife: input.toolLife,
      toolChangeTimeSec: input.toolChangeTimeSec,
      price: input.price,
      currency: input.currency,
      wearFactorCurve: input.wearFactorCurve,
      now,
    });

    await this.toolProfileRepository.save(profile);
    await this.eventPublisher.publish(
      buildCalculationEngineEvent({
        type: "tool_profile.created",
        tenantId,
        siteId: profile.siteId,
        entityId: profile.id,
        entityVersion: profile.recordVersion,
        actorId: input.actorId,
        correlationId: input.correlationId,
        occurredAt: now,
      })
    );

    return profile.toPlainObject();
  }
}
