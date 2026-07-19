import { ExternalSystemRepository } from "@/domain/repositories/external-system-repository";
import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { NotFoundError } from "@/domain/errors/not-found-error";

export class ReactivateExternalSystemUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly externalSystemRepository: ExternalSystemRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(id: string): Promise<void> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.IntegrationErpConfigure, "write");

    const system = await this.externalSystemRepository.findById(id, tenantId);
    if (!system) throw new NotFoundError("ExternalSystem", id);

    system.setStatus("active");
    await this.externalSystemRepository.save(system);
  }
}
