import { TenantContext } from "@/domain/services/tenant-context";
import { MachineRepository } from "@/domain/repositories/machine-repository";
import { NotFoundError } from "@/domain/errors/not-found-error";
import { MachineProfileRepository } from "@/domain/calculation-engine/repositories/machine-profile-repository";
import { MachineProfileFactory } from "@/domain/calculation-engine/profiles/machine-profile-factory";
import { MachineWorkEnvelope } from "@/domain/calculation-engine/profiles/machine-work-envelope";
import { MachineCapabilitySummary } from "@/domain/calculation-engine/shared/machine-capability-summary";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { DomainEventPublisher } from "@/domain/calculation-engine/events/domain-event-publisher";
import { buildCalculationEngineEvent } from "@/domain/calculation-engine/events/build-calculation-engine-event";

export interface CreateMachineProfileInput {
  machineId: string;
  siteId?: string;
  workEnvelope?: MachineWorkEnvelope;
  maxPartDimensions?: MachineWorkEnvelope;
  maxPartWeightKg?: number;
  availableFunctions?: readonly MachineCapabilitySummary[];
  powerCoefficient?: number;
  ageCoefficient?: number;
  conditionCoefficient?: number;
  actorId?: string;
  correlationId?: string;
}

/** `CreateMachineProfileUseCase` (AP-MCE-001 Fáze B §11) - založí kalkulační
 *  `MachineProfile` z už existujícího `Machine` master-data záznamu. Vyžaduje
 *  `calculation.admin` (§12). */
export class CreateMachineProfileUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly machineRepository: MachineRepository,
    private readonly machineProfileRepository: MachineProfileRepository,
    private readonly featureAccessService: FeatureAccessService,
    private readonly eventPublisher: DomainEventPublisher
  ) {}

  async execute(input: CreateMachineProfileInput): Promise<Record<string, unknown>> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationAdmin, "write");

    const machine = await this.machineRepository.findById(input.machineId, tenantId);
    if (!machine) throw new NotFoundError("Machine", input.machineId);

    const now = new Date().toISOString();
    const profile = MachineProfileFactory.createFromMachine({
      id: crypto.randomUUID(),
      machine,
      siteId: input.siteId,
      workEnvelope: input.workEnvelope,
      maxPartDimensions: input.maxPartDimensions,
      maxPartWeightKg: input.maxPartWeightKg,
      availableFunctions: input.availableFunctions,
      powerCoefficient: input.powerCoefficient,
      ageCoefficient: input.ageCoefficient,
      conditionCoefficient: input.conditionCoefficient,
      now,
    });

    await this.machineProfileRepository.save(profile);
    await this.eventPublisher.publish(
      buildCalculationEngineEvent({
        type: "machine_profile.created",
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
