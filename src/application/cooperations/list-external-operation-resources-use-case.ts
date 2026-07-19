import { ExternalOperationResource } from "@/domain/entities/external-operation-resource";
import { ExternalOperationResourceRepository } from "@/domain/repositories/external-operation-resource-repository";
import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";

export class ListExternalOperationResourcesUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly resourceRepository: ExternalOperationResourceRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(): Promise<ExternalOperationResource[]> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CooperationsView, "read");
    return this.resourceRepository.list(tenantId);
  }
}
