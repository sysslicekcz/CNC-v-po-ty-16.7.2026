import { MaterialGroup } from "@/domain/entities/material-group";
import { MaterialGroupRepository } from "@/domain/repositories/material-group-repository";
import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";

export class ListMaterialGroupsUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly materialGroupRepository: MaterialGroupRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(): Promise<MaterialGroup[]> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.MaterialsView, "read");
    return this.materialGroupRepository.list(tenantId);
  }
}
