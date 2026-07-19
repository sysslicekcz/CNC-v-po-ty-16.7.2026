import { MachineCapabilityRepository } from "@/domain/repositories/machine-capability-repository";
import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";

export class RemoveMachineCapabilityUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly capabilityRepository: MachineCapabilityRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(id: string): Promise<void> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.MachinesManage, "write");
    await this.capabilityRepository.delete(id, tenantId);
  }
}
