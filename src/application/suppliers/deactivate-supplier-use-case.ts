import { SupplierRepository } from "@/domain/repositories/supplier-repository";
import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { NotFoundError } from "@/domain/errors/not-found-error";

export class DeactivateSupplierUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly supplierRepository: SupplierRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(id: string): Promise<void> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CooperationsManage, "write");

    const supplier = await this.supplierRepository.findById(id, tenantId);
    if (!supplier) throw new NotFoundError("Supplier", id);

    supplier.setStatus("inactive");
    await this.supplierRepository.save(supplier);
  }
}
