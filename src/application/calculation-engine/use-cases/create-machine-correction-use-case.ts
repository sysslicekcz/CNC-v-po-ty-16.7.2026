import { TenantContext } from "@/domain/services/tenant-context";
import { MachineProfileRepository } from "@/domain/calculation-engine/repositories/machine-profile-repository";
import { MachineProfileNotFoundError } from "@/domain/calculation-engine/errors/profile-not-found-error";
import { InvalidMachineCoefficientError } from "@/domain/calculation-engine/errors/invalid-coefficient-error";
import { MachineCorrection } from "@/domain/calculation-engine/profiles/machine-correction";
import { MachineSetupTimeProfile } from "@/domain/calculation-engine/profiles/machine-setup-time-profile";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { DomainEventPublisher } from "@/domain/calculation-engine/events/domain-event-publisher";
import { buildCalculationEngineEvent } from "@/domain/calculation-engine/events/build-calculation-engine-event";

export interface CreateMachineCorrectionInput {
  machineProfileId: string;
  powerCoefficient?: number;
  ageCoefficient?: number;
  conditionCoefficient?: number;
  typicalSetupTimes?: readonly MachineSetupTimeProfile[];
  reason: string;
  createdBy?: string;
  actorId?: string;
  correlationId?: string;
}

const COEFFICIENT_FIELDS = ["powerCoefficient", "ageCoefficient", "conditionCoefficient"] as const;

/** `CreateMachineCorrectionUseCase` (AP-MCE-001 Fáze B §11) - viz
 *  `CreateMaterialCorrectionUseCase` pro plné zdůvodnění vzoru. Vyžaduje
 *  `calculation.admin`. */
export class CreateMachineCorrectionUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly repository: MachineProfileRepository,
    private readonly featureAccessService: FeatureAccessService,
    private readonly eventPublisher: DomainEventPublisher
  ) {}

  async execute(input: CreateMachineCorrectionInput): Promise<Record<string, unknown>> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationAdmin, "write");

    const profile = await this.repository.getById(input.machineProfileId, tenantId);
    if (!profile) throw new MachineProfileNotFoundError(input.machineProfileId, tenantId);

    for (const field of COEFFICIENT_FIELDS) {
      const value = input[field];
      if (value !== undefined && (!Number.isFinite(value) || value <= 0)) {
        throw new InvalidMachineCoefficientError(input.machineProfileId, field, value);
      }
    }

    const existingCorrection = await this.repository.findCorrectionByProfileId(input.machineProfileId, tenantId);
    const now = new Date().toISOString();
    const correction = MachineCorrection.create({
      id: existingCorrection?.id ?? crypto.randomUUID(),
      tenantId,
      machineProfileId: input.machineProfileId,
      powerCoefficient: input.powerCoefficient,
      ageCoefficient: input.ageCoefficient,
      conditionCoefficient: input.conditionCoefficient,
      typicalSetupTimes: input.typicalSetupTimes,
      reason: input.reason,
      createdBy: input.createdBy,
      recordVersion: (existingCorrection?.recordVersion ?? 0) + 1,
      createdAt: existingCorrection?.createdAt ?? now,
      updatedAt: now,
    });

    await this.repository.saveCorrection(correction);
    await this.eventPublisher.publish(
      buildCalculationEngineEvent({
        type: "machine_correction.created",
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
