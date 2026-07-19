import { MachineCapabilityValueRepository } from "@/domain/repositories/machine-capability-value-repository";
import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";

export class RemoveMachineCapabilityValueUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly valueRepository: MachineCapabilityValueRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(id: string): Promise<void> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.MachinesManage, "write");
    await this.valueRepository.delete(id, tenantId);
  }
}
