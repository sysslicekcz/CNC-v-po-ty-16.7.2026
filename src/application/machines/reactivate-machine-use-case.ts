import { MachineRepository } from "@/domain/repositories/machine-repository";
import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { NotFoundError } from "@/domain/errors/not-found-error";

export class ReactivateMachineUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly machineRepository: MachineRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(machineId: string): Promise<void> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.MachinesManage, "write");

    const machine = await this.machineRepository.findById(machineId, tenantId);
    if (!machine) throw new NotFoundError("Machine", machineId);

    machine.setStatus("active");
    await this.machineRepository.save(machine);
  }
}
