import { TenantContext } from "@/domain/services/tenant-context";
import { MaterialProfileRepository } from "@/domain/calculation-engine/repositories/material-profile-repository";
import { MaterialProfileNotFoundError } from "@/domain/calculation-engine/errors/profile-not-found-error";
import { InvalidMaterialCoefficientError } from "@/domain/calculation-engine/errors/invalid-coefficient-error";
import { MaterialCorrection } from "@/domain/calculation-engine/profiles/material-correction";
import { MaterialCuttingRecommendation } from "@/domain/calculation-engine/profiles/material-cutting-recommendation";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { DomainEventPublisher } from "@/domain/calculation-engine/events/domain-event-publisher";
import { buildCalculationEngineEvent } from "@/domain/calculation-engine/events/build-calculation-engine-event";

export interface CreateMaterialCorrectionInput {
  materialProfileId: string;
  materialCoefficient?: number;
  recommendedCuttingSpeeds?: readonly MaterialCuttingRecommendation[];
  recommendedFeeds?: readonly MaterialCuttingRecommendation[];
  notes?: string;
  reason: string;
  createdBy?: string;
  actorId?: string;
  correlationId?: string;
}

/**
 * `CreateMaterialCorrectionUseCase` (AP-MCE-001 Fáze B §11) - založí tenant
 * `MaterialCorrection` VEDLE systémového `MaterialProfile` (nikdy ho
 * nepřepisuje - viz `resolveMaterialProfileOverlay`). Vyžaduje
 * `calculation.admin` stejně jako správa profilů (§12).
 */
export class CreateMaterialCorrectionUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly repository: MaterialProfileRepository,
    private readonly featureAccessService: FeatureAccessService,
    private readonly eventPublisher: DomainEventPublisher
  ) {}

  async execute(input: CreateMaterialCorrectionInput): Promise<Record<string, unknown>> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationAdmin, "write");

    const profile = await this.repository.getById(input.materialProfileId, tenantId);
    if (!profile) throw new MaterialProfileNotFoundError(input.materialProfileId, tenantId);

    if (input.materialCoefficient !== undefined && (!Number.isFinite(input.materialCoefficient) || input.materialCoefficient <= 0)) {
      throw new InvalidMaterialCoefficientError(input.materialProfileId, input.materialCoefficient);
    }

    const existingCorrection = await this.repository.findCorrectionByProfileId(input.materialProfileId, tenantId);
    const now = new Date().toISOString();
    const correction = MaterialCorrection.create({
      id: existingCorrection?.id ?? crypto.randomUUID(),
      tenantId,
      materialProfileId: input.materialProfileId,
      materialCoefficient: input.materialCoefficient,
      recommendedCuttingSpeeds: input.recommendedCuttingSpeeds,
      recommendedFeeds: input.recommendedFeeds,
      notes: input.notes,
      reason: input.reason,
      createdBy: input.createdBy,
      recordVersion: (existingCorrection?.recordVersion ?? 0) + 1,
      createdAt: existingCorrection?.createdAt ?? now,
      updatedAt: now,
    });

    await this.repository.saveCorrection(correction);
    await this.eventPublisher.publish(
      buildCalculationEngineEvent({
        type: "material_correction.created",
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
