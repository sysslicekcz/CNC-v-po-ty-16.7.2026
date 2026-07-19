import { OperationTypeCapabilityRequirementRepository } from "@/domain/repositories/operation-type-capability-requirement-repository";
import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";

export class RemoveOperationTypeCapabilityRequirementUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly requirementRepository: OperationTypeCapabilityRequirementRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(id: string): Promise<void> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.OperationTypesManage, "write");
    await this.requirementRepository.delete(id, tenantId);
  }
}
