import { ToolType } from "@/domain/entities/tool-type";
import { ToolTypeRepository } from "@/domain/repositories/tool-type-repository";
import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";

export class ListToolTypesUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly toolTypeRepository: ToolTypeRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(): Promise<ToolType[]> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.ToolsView, "read");
    return this.toolTypeRepository.list(tenantId);
  }
}
