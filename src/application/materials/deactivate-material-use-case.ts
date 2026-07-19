import { MaterialRepository } from "@/domain/repositories/material-repository";
import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { NotFoundError } from "@/domain/errors/not-found-error";

export class DeactivateMaterialUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly materialRepository: MaterialRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(id: string): Promise<void> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.MaterialsManage, "write");

    const material = await this.materialRepository.findById(id, tenantId);
    if (!material) throw new NotFoundError("Material", id);

    material.setStatus("inactive");
    await this.materialRepository.save(material);
  }
}
