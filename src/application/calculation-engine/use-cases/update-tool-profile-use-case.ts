import { TenantContext } from "@/domain/services/tenant-context";
import { ToolProfileRepository } from "@/domain/calculation-engine/repositories/tool-profile-repository";
import { ToolProfileNotFoundError } from "@/domain/calculation-engine/errors/profile-not-found-error";
import { ProfileVersionConflictError } from "@/domain/calculation-engine/errors/profile-version-conflict-error";
import { CrossTenantAccessError } from "@/domain/calculation-engine/errors/cross-tenant-access-error";
import { ToolProfileProps } from "@/domain/calculation-engine/profiles/tool-profile";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { DomainEventPublisher } from "@/domain/calculation-engine/events/domain-event-publisher";
import { buildCalculationEngineEvent } from "@/domain/calculation-engine/events/build-calculation-engine-event";

export interface UpdateToolProfileInput {
  toolProfileId: string;
  expectedVersion: number;
  changes: Partial<
    Pick<
      ToolProfileProps,
      | "toolLife"
      | "wearFactorCurve"
      | "toolChangeTimeSec"
      | "price"
      | "currency"
      | "defaultCuttingParameters"
      | "suitableMaterialGroupIds"
      | "tenantCorrectionId"
    >
  >;
  actorId?: string;
  correlationId?: string;
}

/** `UpdateToolProfileUseCase` (AP-MCE-001 Fáze B §11) - viz `UpdateMaterial
 *  ProfileUseCase` pro plné zdůvodnění vzoru. Vyžaduje `calculation.admin`. */
export class UpdateToolProfileUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly repository: ToolProfileRepository,
    private readonly featureAccessService: FeatureAccessService,
    private readonly eventPublisher: DomainEventPublisher
  ) {}

  async execute(input: UpdateToolProfileInput): Promise<Record<string, unknown>> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationAdmin, "write");

    const existing = await this.repository.getById(input.toolProfileId, tenantId);
    if (!existing) throw new ToolProfileNotFoundError(input.toolProfileId, tenantId);
    if (existing.tenantId !== tenantId) throw new CrossTenantAccessError("ToolProfile", input.toolProfileId, tenantId);
    if (existing.recordVersion !== input.expectedVersion) {
      throw new ProfileVersionConflictError(input.toolProfileId, input.expectedVersion, existing.recordVersion);
    }

    const now = new Date().toISOString();
    const updated = existing.withChanges(input.changes, now);
    await this.repository.save(updated);

    await this.eventPublisher.publish(
      buildCalculationEngineEvent({
        type: "tool_profile.updated",
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
