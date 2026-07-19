import { MachineRepository } from "@/domain/repositories/machine-repository";
import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { NotFoundError } from "@/domain/errors/not-found-error";
import { MasterDataInUseError } from "@/domain/errors/master-data-errors";
import { MasterDataUsageChecker } from "@/domain/services/master-data-usage-checker";

/** Fyzické smazání jen pro NEPOUŽITÝ stroj (Krok 5, zadání bod 23/61) -
 *  preferovaná cesta zůstává `DeactivateMachineUseCase`. */
export class DeleteMachineUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly machineRepository: MachineRepository,
    private readonly usageChecker: MasterDataUsageChecker,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(machineId: string): Promise<void> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.MachinesManage, "write");

    const machine = await this.machineRepository.findById(machineId, tenantId);
    if (!machine) throw new NotFoundError("Machine", machineId);

    if (await this.usageChecker.isMachineInUse(machineId, tenantId)) {
      throw new MasterDataInUseError("Stroj", machineId);
    }

    await this.machineRepository.delete(machineId, tenantId);
  }
}
