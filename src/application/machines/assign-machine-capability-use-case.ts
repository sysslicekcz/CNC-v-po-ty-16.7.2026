import { MachineCapability } from "@/domain/entities/machine-capability";
import { MachineCapabilityRepository } from "@/domain/repositories/machine-capability-repository";
import { MachineRepository } from "@/domain/repositories/machine-repository";
import { OperationTypeRepository } from "@/domain/repositories/operation-type-repository";
import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { NotFoundError } from "@/domain/errors/not-found-error";

export interface AssignMachineCapabilityInput {
  machineId: string;
  operationTypeId: string;
  enabled?: boolean;
  priority?: number;
}

/**
 * Přiřadí (nebo upraví) schopnost stroje provádět daný typ operace (existující
 * `MachineCapability`, ne nová `MachineCapabilityValue` - viz
 * docs/adr/machine-capabilities-use-explicit-types.md). Založí novou vazbu,
 * nebo pokud už existuje, jen upraví `enabled`/`priority`.
 */
export class AssignMachineCapabilityUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly capabilityRepository: MachineCapabilityRepository,
    private readonly machineRepository: MachineRepository,
    private readonly operationTypeRepository: OperationTypeRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(input: AssignMachineCapabilityInput): Promise<MachineCapability> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.MachinesManage, "write");

    const machine = await this.machineRepository.findById(input.machineId, tenantId);
    if (!machine) throw new NotFoundError("Machine", input.machineId);
    const operationType = await this.operationTypeRepository.findById(input.operationTypeId, tenantId);
    if (!operationType) throw new NotFoundError("OperationType", input.operationTypeId);

    const existing = (await this.capabilityRepository.findByMachineId(input.machineId, tenantId)).find(
      (c) => c.operationTypeId === input.operationTypeId
    );

    if (existing) {
      existing.setEnabled(input.enabled ?? true);
      existing.setPriority(input.priority);
      await this.capabilityRepository.save(existing);
      return existing;
    }

    const capability = MachineCapability.create({
      id: crypto.randomUUID(),
      tenantId,
      machineId: input.machineId,
      operationTypeId: input.operationTypeId,
      enabled: input.enabled ?? true,
      priority: input.priority,
    });
    await this.capabilityRepository.save(capability);
    return capability;
  }
}
