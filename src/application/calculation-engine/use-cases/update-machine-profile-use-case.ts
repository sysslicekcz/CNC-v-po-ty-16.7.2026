import { TenantContext } from "@/domain/services/tenant-context";
import { MachineProfileRepository } from "@/domain/calculation-engine/repositories/machine-profile-repository";
import { MachineProfileNotFoundError } from "@/domain/calculation-engine/errors/profile-not-found-error";
import { ProfileVersionConflictError } from "@/domain/calculation-engine/errors/profile-version-conflict-error";
import { CrossTenantAccessError } from "@/domain/calculation-engine/errors/cross-tenant-access-error";
import { MachineProfileProps } from "@/domain/calculation-engine/profiles/machine-profile";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { DomainEventPublisher } from "@/domain/calculation-engine/events/domain-event-publisher";
import { buildCalculationEngineEvent } from "@/domain/calculation-engine/events/build-calculation-engine-event";

export interface UpdateMachineProfileInput {
  machineProfileId: string;
  expectedVersion: number;
  changes: Partial<
    Pick<
      MachineProfileProps,
      | "powerCoefficient"
      | "ageCoefficient"
      | "conditionCoefficient"
      | "typicalSetupTimes"
      | "workEnvelope"
      | "maxPartDimensions"
      | "maxPartWeightKg"
      | "tenantCorrectionId"
      | "calibrationProfileId"
    >
  >;
  actorId?: string;
  correlationId?: string;
}

/** `UpdateMachineProfileUseCase` (AP-MCE-001 Fáze B §11) - viz `UpdateMaterial
 *  ProfileUseCase` pro plné zdůvodnění vzoru (přímá editace systémového
 *  profilu, ne tenant korekce). Vyžaduje `calculation.admin`. */
export class UpdateMachineProfileUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly repository: MachineProfileRepository,
    private readonly featureAccessService: FeatureAccessService,
    private readonly eventPublisher: DomainEventPublisher
  ) {}

  async execute(input: UpdateMachineProfileInput): Promise<Record<string, unknown>> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationAdmin, "write");

    const existing = await this.repository.getById(input.machineProfileId, tenantId);
    if (!existing) throw new MachineProfileNotFoundError(input.machineProfileId, tenantId);
    if (existing.tenantId !== tenantId) throw new CrossTenantAccessError("MachineProfile", input.machineProfileId, tenantId);
    if (existing.recordVersion !== input.expectedVersion) {
      throw new ProfileVersionConflictError(input.machineProfileId, input.expectedVersion, existing.recordVersion);
    }

    const now = new Date().toISOString();
    const updated = existing.withChanges(input.changes, now);
    await this.repository.save(updated);

    await this.eventPublisher.publish(
      buildCalculationEngineEvent({
        type: "machine_profile.updated",
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
