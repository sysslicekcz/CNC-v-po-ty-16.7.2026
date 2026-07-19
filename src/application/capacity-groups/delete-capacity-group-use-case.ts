import { CapacityGroupRepository } from "@/domain/repositories/capacity-group-repository";
import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { NotFoundError } from "@/domain/errors/not-found-error";
import { MasterDataInUseError } from "@/domain/errors/master-data-errors";
import { MasterDataUsageChecker } from "@/domain/services/master-data-usage-checker";

/** Skupinu s přiřazenými stroji nelze fyzicky smazat (Krok 5, zadání bod 9) -
 *  napřed je nutné stroje odebrat/přeřadit (`AssignMachineToCapacityGroupUseCase`)
 *  nebo skupinu jen deaktivovat. */
export class DeleteCapacityGroupUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly capacityGroupRepository: CapacityGroupRepository,
    private readonly usageChecker: MasterDataUsageChecker,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(id: string): Promise<void> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.MachinesCapacityGroups, "write");

    const group = await this.capacityGroupRepository.findById(id, tenantId);
    if (!group) throw new NotFoundError("CapacityGroup", id);

    if (await this.usageChecker.isCapacityGroupInUse(id, tenantId)) {
      throw new MasterDataInUseError("Kapacitní skupina", id, "má přiřazené stroje");
    }

    await this.capacityGroupRepository.delete(id, tenantId);
  }
}
