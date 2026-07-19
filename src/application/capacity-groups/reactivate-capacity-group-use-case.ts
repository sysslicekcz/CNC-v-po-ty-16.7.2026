import { CapacityGroupRepository } from "@/domain/repositories/capacity-group-repository";
import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { NotFoundError } from "@/domain/errors/not-found-error";

export class ReactivateCapacityGroupUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly capacityGroupRepository: CapacityGroupRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(id: string): Promise<void> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.MachinesCapacityGroups, "write");

    const group = await this.capacityGroupRepository.findById(id, tenantId);
    if (!group) throw new NotFoundError("CapacityGroup", id);

    group.setStatus("active");
    await this.capacityGroupRepository.save(group);
  }
}
