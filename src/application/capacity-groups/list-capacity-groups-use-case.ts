import { CapacityGroup } from "@/domain/entities/capacity-group";
import { CapacityGroupRepository } from "@/domain/repositories/capacity-group-repository";
import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";

export class ListCapacityGroupsUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly capacityGroupRepository: CapacityGroupRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(): Promise<CapacityGroup[]> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.MachinesView, "read");
    return this.capacityGroupRepository.list(tenantId);
  }
}
