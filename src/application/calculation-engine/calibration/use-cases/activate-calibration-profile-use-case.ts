import { TenantContext } from "@/domain/services/tenant-context";
import { CalibrationProposalRepository } from "@/domain/calculation-engine/repositories/calibration-proposal-repository";
import { CalibrationProfileRepository } from "@/domain/calculation-engine/repositories/calibration-profile-repository";
import { CalibrationProfile } from "@/domain/calculation-engine/calibration/calibration-profile";
import { CoefficientTarget } from "@/domain/calculation-engine/calibration/coefficient-target";
import { CalculationError } from "@/domain/calculation-engine/errors/calculation-error";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { DomainEventPublisher } from "@/domain/calculation-engine/events/domain-event-publisher";
import { buildCalculationEngineEvent } from "@/domain/calculation-engine/events/build-calculation-engine-event";

export interface ActivateCalibrationProfileInput {
  proposalId: string;
  name: string;
  description?: string;
  siteId?: string;
  operationCategory?: import("@/domain/calculation-engine/enums/operation-category").OperationCategory;
  operationSubtype?: string;
  machineProfileId?: string;
  materialGroupId?: string;
  toolTypeId?: string;
  workstationId?: string;
  validFrom: string;
  validTo?: string;
  /** Pokud vyplněné, PŘEDCHOZÍ aktivní profil se pro stejný `scope` supersedne
   *  (§13/§18 "ochrana proti retroaktivní změně starých výsledků" -
   *  supersede nikdy neSMAŽE starou verzi, jen změní `status`). */
  previousActiveProfileId?: string;
  activatedBy: string;
  actorId?: string;
  correlationId?: string;
}

/**
 * `ActivateCalibrationProfileUseCase` (AP-MCE-001 Fáze G §13/§21/§22) -
 * POSLEDNÍ krok kalibračního workflow (§21 bod 8/9). Vyžaduje SCHVÁLENÝ
 * `CalibrationProposal` (`status === "approved"`) - vytvoří NOVÝ
 * `CalibrationProfile` (`status: "active"`, `parentVersionId` odkazuje na
 * předchozí aktivní verzi, pokud existovala) a supersedne starou.
 */
export class ActivateCalibrationProfileUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly proposalRepository: CalibrationProposalRepository,
    private readonly profileRepository: CalibrationProfileRepository,
    private readonly featureAccessService: FeatureAccessService,
    private readonly eventPublisher: DomainEventPublisher
  ) {}

  async execute(input: ActivateCalibrationProfileInput): Promise<Record<string, unknown>> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationCalibrationActivate, "write");

    const proposal = await this.proposalRepository.getById(input.proposalId, tenantId);
    if (!proposal) throw new CalculationError(`CalibrationProposal "${input.proposalId}" nebyl nalezen.`);
    if (proposal.status !== "approved") {
      throw new CalculationError(`CalibrationProposal "${input.proposalId}" musí být "approved" (aktuálně "${proposal.status}").`);
    }

    let previousProfile: CalibrationProfile | null = null;
    if (input.previousActiveProfileId) {
      previousProfile = await this.profileRepository.getById(input.previousActiveProfileId, tenantId);
    }

    const now = new Date().toISOString();
    const coefficientTargets: CoefficientTarget[] = proposal.coefficientDiffs.map((diff) => ({
      name: diff.name,
      originalValue: diff.currentValue,
      proposedValue: diff.proposedValue,
      minimumAllowed: 0.5,
      maximumAllowed: 2,
      sampleCount: proposal.predictedImpact.sampleCount,
      effectiveWeight: proposal.predictedImpact.sampleCount,
      confidence: proposal.confidence,
      warnings: [],
    }));

    const newProfile = CalibrationProfile.create({
      id: crypto.randomUUID(),
      tenantId,
      siteId: input.siteId,
      name: input.name,
      description: input.description,
      scope: proposal.profileScope,
      operationCategory: input.operationCategory,
      operationSubtype: input.operationSubtype,
      machineProfileId: input.machineProfileId,
      materialGroupId: input.materialGroupId,
      toolTypeId: input.toolTypeId,
      workstationId: input.workstationId,
      coefficientTargets,
      sampleCount: proposal.predictedImpact.sampleCount,
      effectiveSampleCount: proposal.predictedImpact.sampleCount,
      coefficientValues: proposal.proposedCoefficients,
      confidenceScore: proposal.confidence,
      status: "active",
      calibrationMethod: "generated_proposal",
      validFrom: input.validFrom,
      validTo: input.validTo,
      approvedBy: input.activatedBy,
      approvedAt: now,
      recordVersion: (previousProfile?.recordVersion ?? 0) + 1,
      parentVersionId: previousProfile?.id,
      createdAt: now,
      updatedAt: now,
    });
    await this.profileRepository.save(newProfile);

    if (previousProfile) {
      await this.profileRepository.save(previousProfile.supersede(now));
      await this.eventPublisher.publish(
        buildCalculationEngineEvent({ type: "calibration_profile.superseded", tenantId, entityId: previousProfile.id, actorId: input.actorId, correlationId: input.correlationId })
      );
    }

    await this.proposalRepository.save(proposal.apply());

    await this.eventPublisher.publish(
      buildCalculationEngineEvent({ type: "calibration_profile.activated", tenantId, entityId: newProfile.id, entityVersion: newProfile.recordVersion, actorId: input.actorId, correlationId: input.correlationId })
    );

    return newProfile.toPlainObject();
  }
}
