import { MaterialGroupRepository } from "@/domain/repositories/material-group-repository";
import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { NotFoundError } from "@/domain/errors/not-found-error";

export class DeactivateMaterialGroupUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly materialGroupRepository: MaterialGroupRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(id: string): Promise<void> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.MaterialsManage, "write");

    const group = await this.materialGroupRepository.findById(id, tenantId);
    if (!group) throw new NotFoundError("MaterialGroup", id);

    group.setStatus("inactive");
    await this.materialGroupRepository.save(group);
  }
}
