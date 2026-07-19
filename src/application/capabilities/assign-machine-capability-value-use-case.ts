import { MachineCapabilityValue } from "@/domain/entities/machine-capability-value";
import { MachineCapabilityValueRepository } from "@/domain/repositories/machine-capability-value-repository";
import { MachineRepository } from "@/domain/repositories/machine-repository";
import { CapabilityTypeRepository } from "@/domain/repositories/capability-type-repository";
import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { NotFoundError } from "@/domain/errors/not-found-error";
import { InvalidMasterDataValueError } from "@/domain/errors/master-data-errors";

export interface AssignMachineCapabilityValueInput {
  machineId: string;
  capabilityTypeId: string;
  value: string | number | boolean;
}

/** Založí NEBO přepíše hodnotu capability na stroji (Krok 5, zadání bod 34) -
 *  validuje hodnotu proti `CapabilityType.valueType`/`allowedValues` PŘED
 *  uložením (zadání bod 63). */
export class AssignMachineCapabilityValueUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly valueRepository: MachineCapabilityValueRepository,
    private readonly machineRepository: MachineRepository,
    private readonly capabilityTypeRepository: CapabilityTypeRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(input: AssignMachineCapabilityValueInput): Promise<MachineCapabilityValue> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.MachinesManage, "write");

    const machine = await this.machineRepository.findById(input.machineId, tenantId);
    if (!machine) throw new NotFoundError("Machine", input.machineId);
    const capabilityType = await this.capabilityTypeRepository.findById(input.capabilityTypeId, tenantId);
    if (!capabilityType) throw new NotFoundError("CapabilityType", input.capabilityTypeId);

    const validationError = capabilityType.validateValue(input.value);
    if (validationError) throw new InvalidMasterDataValueError(validationError);

    const existing = (await this.valueRepository.findByMachineId(input.machineId, tenantId)).find(
      (v) => v.capabilityTypeId === input.capabilityTypeId
    );

    if (existing) {
      existing.setValue(input.value);
      await this.valueRepository.save(existing);
      return existing;
    }

    const value = MachineCapabilityValue.create({
      id: crypto.randomUUID(),
      tenantId,
      machineId: input.machineId,
      capabilityTypeId: input.capabilityTypeId,
      value: input.value,
    });
    await this.valueRepository.save(value);
    return value;
  }
}
