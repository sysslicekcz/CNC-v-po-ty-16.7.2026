import { ExternalSystem } from "@/domain/integrations/external-system";
import { ExternalSystemRepository } from "@/domain/repositories/external-system-repository";
import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";

export class ListExternalSystemsUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly externalSystemRepository: ExternalSystemRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(): Promise<ExternalSystem[]> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.IntegrationErpView, "read");
    return this.externalSystemRepository.list(tenantId);
  }
}
