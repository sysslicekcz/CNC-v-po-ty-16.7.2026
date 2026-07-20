import { TenantContext } from "@/domain/services/tenant-context";
import { MaterialProfileRepository } from "@/domain/calculation-engine/repositories/material-profile-repository";
import { MaterialProfileNotFoundError } from "@/domain/calculation-engine/errors/profile-not-found-error";
import { ProfileVersionConflictError } from "@/domain/calculation-engine/errors/profile-version-conflict-error";
import { CrossTenantAccessError } from "@/domain/calculation-engine/errors/cross-tenant-access-error";
import { MaterialProfileProps } from "@/domain/calculation-engine/profiles/material-profile";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { DomainEventPublisher } from "@/domain/calculation-engine/events/domain-event-publisher";
import { buildCalculationEngineEvent } from "@/domain/calculation-engine/events/build-calculation-engine-event";

export interface UpdateMaterialProfileInput {
  materialProfileId: string;
  expectedVersion: number;
  changes: Partial<
    Pick<
      MaterialProfileProps,
      | "name"
      | "standard"
      | "designation"
      | "hardness"
      | "hardnessScale"
      | "tensileStrengthMpa"
      | "densityKgM3"
      | "machinabilityIndex"
      | "materialCoefficient"
      | "recommendedCuttingSpeeds"
      | "recommendedFeeds"
      | "suitableToolTypeIds"
      | "notes"
    >
  >;
  actorId?: string;
  correlationId?: string;
}

/** `UpdateMaterialProfileUseCase` (AP-MCE-001 Fáze B §11) - edituje PŘÍMO
 *  systémový `MaterialProfile` (na rozdíl od `CreateMaterialCorrectionUseCase`,
 *  který vytváří tenant korekci VEDLE něj) - použití: správce master dat, ne
 *  běžný tenant. Vyžaduje `calculation.admin`. */
export class UpdateMaterialProfileUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly repository: MaterialProfileRepository,
    private readonly featureAccessService: FeatureAccessService,
    private readonly eventPublisher: DomainEventPublisher
  ) {}

  async execute(input: UpdateMaterialProfileInput): Promise<Record<string, unknown>> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationAdmin, "write");

    const existing = await this.repository.getById(input.materialProfileId, tenantId);
    if (!existing) throw new MaterialProfileNotFoundError(input.materialProfileId, tenantId);
    if (existing.tenantId !== tenantId) throw new CrossTenantAccessError("MaterialProfile", input.materialProfileId, tenantId);
    if (existing.recordVersion !== input.expectedVersion) {
      throw new ProfileVersionConflictError(input.materialProfileId, input.expectedVersion, existing.recordVersion);
    }

    const now = new Date().toISOString();
    const updated = existing.withChanges(input.changes, now);
    await this.repository.save(updated);

    await this.eventPublisher.publish(
      buildCalculationEngineEvent({
        type: "material_profile.updated",
        tenantId,
        siteId: updated.siteId,
        entityId: updated.id,
        entityVersion: updated.recordVersion,
        actorId: input.actorId,
        correlationId: input.correlationId,
        occurredAt: now,
      })
    );

    return updated.toPlainObject();
  }
}
