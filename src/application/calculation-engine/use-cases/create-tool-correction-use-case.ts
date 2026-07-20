import { TenantContext } from "@/domain/services/tenant-context";
import { ToolProfileRepository } from "@/domain/calculation-engine/repositories/tool-profile-repository";
import { ToolProfileNotFoundError } from "@/domain/calculation-engine/errors/profile-not-found-error";
import { InvalidToolLifeError } from "@/domain/calculation-engine/errors/invalid-tool-life-error";
import { ToolCorrection } from "@/domain/calculation-engine/profiles/tool-correction";
import { ToolLifeProfile } from "@/domain/calculation-engine/profiles/tool-life-profile";
import { ToolWearCurve } from "@/domain/calculation-engine/profiles/tool-wear-curve";
import { ToolCuttingParameters } from "@/domain/calculation-engine/profiles/tool-cutting-parameters";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { DomainEventPublisher } from "@/domain/calculation-engine/events/domain-event-publisher";
import { buildCalculationEngineEvent } from "@/domain/calculation-engine/events/build-calculation-engine-event";

export interface CreateToolCorrectionInput {
  toolProfileId: string;
  toolLife?: ToolLifeProfile;
  wearFactorCurve?: ToolWearCurve;
  toolChangeTimeSec?: number;
  defaultCuttingParameters?: readonly ToolCuttingParameters[];
  reason: string;
  createdBy?: string;
  actorId?: string;
  correlationId?: string;
}

/** `CreateToolCorrectionUseCase` (AP-MCE-001 Fáze B §11) - viz `CreateMaterial
 *  CorrectionUseCase` pro plné zdůvodnění vzoru. Vyžaduje `calculation.admin`. */
export class CreateToolCorrectionUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly repository: ToolProfileRepository,
    private readonly featureAccessService: FeatureAccessService,
    private readonly eventPublisher: DomainEventPublisher
  ) {}

  async execute(input: CreateToolCorrectionInput): Promise<Record<string, unknown>> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationAdmin, "write");

    const profile = await this.repository.getById(input.toolProfileId, tenantId);
    if (!profile) throw new ToolProfileNotFoundError(input.toolProfileId, tenantId);

    if (input.toolChangeTimeSec !== undefined && (!Number.isFinite(input.toolChangeTimeSec) || input.toolChangeTimeSec < 0)) {
      throw new InvalidToolLifeError(input.toolProfileId, `'toolChangeTimeSec' nesmí být záporné, dostal jsem "${input.toolChangeTimeSec}".`);
    }

    const existingCorrection = await this.repository.findCorrectionByProfileId(input.toolProfileId, tenantId);
    const now = new Date().toISOString();
    const correction = ToolCorrection.create({
      id: existingCorrection?.id ?? crypto.randomUUID(),
      tenantId,
      toolProfileId: input.toolProfileId,
      toolLife: input.toolLife,
      wearFactorCurve: input.wearFactorCurve,
      toolChangeTimeSec: input.toolChangeTimeSec,
      defaultCuttingParameters: input.defaultCuttingParameters,
      reason: input.reason,
      createdBy: input.createdBy,
      recordVersion: (existingCorrection?.recordVersion ?? 0) + 1,
      createdAt: existingCorrection?.createdAt ?? now,
      updatedAt: now,
    });

    await this.repository.saveCorrection(correction);
    await this.eventPublisher.publish(
      buildCalculationEngineEvent({
        type: "tool_correction.created",
        tenantId,
        siteId: profile.siteId,
        entityId: correction.id,
        entityVersion: correction.recordVersion,
        actorId: input.actorId,
        correlationId: input.correlationId,
        occurredAt: now,
      })
    );

    return correction.toPlainObject();
  }
}
