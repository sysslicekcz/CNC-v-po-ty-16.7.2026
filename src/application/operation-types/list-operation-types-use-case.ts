import { OperationType } from "@/domain/entities/operation-type";
import { OperationTypeRepository } from "@/domain/repositories/operation-type-repository";
import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";

export class ListOperationTypesUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly operationTypeRepository: OperationTypeRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(): Promise<OperationType[]> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.OperationTypesView, "read");
    return this.operationTypeRepository.list(tenantId);
  }
}
