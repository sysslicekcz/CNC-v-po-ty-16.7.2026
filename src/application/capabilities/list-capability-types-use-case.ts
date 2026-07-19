import { CapabilityType } from "@/domain/entities/capability-type";
import { CapabilityTypeRepository } from "@/domain/repositories/capability-type-repository";
import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";

export class ListCapabilityTypesUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly capabilityTypeRepository: CapabilityTypeRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(): Promise<CapabilityType[]> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.MachinesView, "read");
    return this.capabilityTypeRepository.list(tenantId);
  }
}
