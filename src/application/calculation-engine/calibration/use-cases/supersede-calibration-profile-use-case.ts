import { TenantContext } from "@/domain/services/tenant-context";
import { CalibrationProfileRepository } from "@/domain/calculation-engine/repositories/calibration-profile-repository";
import { CalculationError } from "@/domain/calculation-engine/errors/calculation-error";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { DomainEventPublisher } from "@/domain/calculation-engine/events/domain-event-publisher";
import { buildCalculationEngineEvent } from "@/domain/calculation-engine/events/build-calculation-engine-event";

export interface SupersedeCalibrationProfileInput {
  calibrationProfileId: string;
  actorId?: string;
  correlationId?: string;
}

/** `SupersedeCalibrationProfileUseCase` (AP-MCE-001 Fáze G §13/§22) -
 *  SAMOSTATNÉ vyřazení profilu BEZ náhrady (na rozdíl od `Activate
 *  CalibrationProfileUseCase`, který supersedne starý profil jako VEDLEJŠÍ
 *  efekt aktivace nového) - použití: "tenhle profil se ukázal jako
 *  nespolehlivý, deaktivuj ho, dokud nevznikne nový návrh". */
export class SupersedeCalibrationProfileUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly repository: CalibrationProfileRepository,
    private readonly featureAccessService: FeatureAccessService,
    private readonly eventPublisher: DomainEventPublisher
  ) {}

  async execute(input: SupersedeCalibrationProfileInput): Promise<Record<string, unknown>> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationCalibrationActivate, "write");

    const profile = await this.repository.getById(input.calibrationProfileId, tenantId);
    if (!profile) throw new CalculationError(`CalibrationProfile "${input.calibrationProfileId}" nebyl nalezen.`);

    const superseded = profile.supersede(new Date().toISOString());
    await this.repository.save(superseded);

    await this.eventPublisher.publish(
      buildCalculationEngineEvent({ type: "calibration_profile.superseded", tenantId, entityId: superseded.id, actorId: input.actorId, correlationId: input.correlationId })
    );

    return superseded.toPlainObject();
  }
}
