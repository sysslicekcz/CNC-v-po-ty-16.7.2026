import { TenantContext } from "@/domain/services/tenant-context";
import { MaterialRepository } from "@/domain/repositories/material-repository";
import { MaterialGroupRepository } from "@/domain/repositories/material-group-repository";
import { NotFoundError } from "@/domain/errors/not-found-error";
import { MaterialError } from "@/domain/calculation-engine/errors/material-error";
import { MaterialProfileRepository } from "@/domain/calculation-engine/repositories/material-profile-repository";
import { MaterialProfileFactory } from "@/domain/calculation-engine/profiles/material-profile-factory";
import { MaterialProfileSourceType } from "@/domain/calculation-engine/profiles/material-profile";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { DomainEventPublisher } from "@/domain/calculation-engine/events/domain-event-publisher";
import { buildCalculationEngineEvent } from "@/domain/calculation-engine/events/build-calculation-engine-event";

export interface CreateMaterialProfileInput {
  materialId: string;
  sourceType: MaterialProfileSourceType;
  dataSource: string;
  materialCoefficient?: number;
  siteId?: string;
  actorId?: string;
  correlationId?: string;
}

/**
 * `CreateMaterialProfileUseCase` (AP-MCE-001 Fáze B §11) - založí kalkulační
 * `MaterialProfile` z už existujícího `Material` master-data záznamu.
 * Správa profilů vyžaduje `calculation.admin` (§12).
 */
export class CreateMaterialProfileUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly materialRepository: MaterialRepository,
    private readonly materialGroupRepository: MaterialGroupRepository,
    private readonly materialProfileRepository: MaterialProfileRepository,
    private readonly featureAccessService: FeatureAccessService,
    private readonly eventPublisher: DomainEventPublisher
  ) {}

  async execute(input: CreateMaterialProfileInput): Promise<Record<string, unknown>> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationAdmin, "write");

    const material = await this.materialRepository.findById(input.materialId, tenantId);
    if (!material) throw MaterialError.notFound(input.materialId);

    const materialGroup = await this.materialGroupRepository.findById(material.materialGroupId, tenantId);
    if (!materialGroup) throw new NotFoundError("MaterialGroup", material.materialGroupId);

    const now = new Date().toISOString();
    const profile = MaterialProfileFactory.createFromMaterial({
      material,
      materialGroup,
      sourceType: input.sourceType,
      dataSource: input.dataSource,
      materialCoefficient: input.materialCoefficient,
      siteId: input.siteId,
      now,
    });

    await this.materialProfileRepository.save(profile);
    await this.eventPublisher.publish(
      buildCalculationEngineEvent({
        type: "material_profile.created",
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
