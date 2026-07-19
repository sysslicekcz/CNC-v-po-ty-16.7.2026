import { OperationTypeRepository } from "@/domain/repositories/operation-type-repository";
import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { NotFoundError } from "@/domain/errors/not-found-error";

export class ReactivateOperationTypeUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly operationTypeRepository: OperationTypeRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(id: string): Promise<void> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.OperationTypesManage, "write");

    const operationType = await this.operationTypeRepository.findById(id, tenantId);
    if (!operationType) throw new NotFoundError("OperationType", id);

    operationType.setStav("aktivni");
    await this.operationTypeRepository.save(operationType);
  }
}
