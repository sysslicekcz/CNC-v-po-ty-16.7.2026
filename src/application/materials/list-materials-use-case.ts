import { Material } from "@/domain/entities/material";
import { MaterialRepository } from "@/domain/repositories/material-repository";
import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";

export class ListMaterialsUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly materialRepository: MaterialRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(): Promise<Material[]> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.MaterialsView, "read");
    return this.materialRepository.list(tenantId);
  }
}
