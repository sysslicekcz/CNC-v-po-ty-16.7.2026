import { ExternalOperationResourceRepository } from "@/domain/repositories/external-operation-resource-repository";
import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { NotFoundError } from "@/domain/errors/not-found-error";
import { MasterDataInUseError } from "@/domain/errors/master-data-errors";
import { MasterDataUsageChecker } from "@/domain/services/master-data-usage-checker";

export class DeleteExternalOperationResourceUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly resourceRepository: ExternalOperationResourceRepository,
    private readonly usageChecker: MasterDataUsageChecker,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(id: string): Promise<void> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CooperationsManage, "write");

    const resource = await this.resourceRepository.findById(id, tenantId);
    if (!resource) throw new NotFoundError("ExternalOperationResource", id);

    if (await this.usageChecker.isExternalResourceInUse(id, tenantId)) {
      throw new MasterDataInUseError("Kooperace", id);
    }

    await this.resourceRepository.delete(id, tenantId);
  }
}
