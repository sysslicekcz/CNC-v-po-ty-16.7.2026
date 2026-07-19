import { MachineRepository } from "@/domain/repositories/machine-repository";
import { CapacityGroupRepository } from "@/domain/repositories/capacity-group-repository";
import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { NotFoundError } from "@/domain/errors/not-found-error";

/** Přiřadí stroj do skupiny sdílené kapacity, nebo ho odebere (`capacityGroupId
 *  = undefined`) - NIKDY neslučuje/nemaže Machine záznamy (Krok 3.5, bod 13,
 *  docs/adr/0017). Víc strojů může sdílet stejnou skupinu. */
export class AssignMachineToCapacityGroupUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly machineRepository: MachineRepository,
    private readonly capacityGroupRepository: CapacityGroupRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(machineId: string, capacityGroupId: string | undefined): Promise<void> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.MachinesCapacityGroups, "write");

    const machine = await this.machineRepository.findById(machineId, tenantId);
    if (!machine) {
      throw new NotFoundError("Machine", machineId);
    }

    if (capacityGroupId !== undefined) {
      const group = await this.capacityGroupRepository.findById(capacityGroupId, tenantId);
      if (!group) {
        throw new NotFoundError("CapacityGroup", capacityGroupId);
      }
    }

    machine.assignToCapacityGroup(capacityGroupId);
    await this.machineRepository.save(machine);
  }
}
