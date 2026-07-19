import { Supplier } from "@/domain/entities/supplier";
import { SupplierRepository } from "@/domain/repositories/supplier-repository";
import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";

export class ListSuppliersUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly supplierRepository: SupplierRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(): Promise<Supplier[]> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CooperationsView, "read");
    return this.supplierRepository.list(tenantId);
  }
}
