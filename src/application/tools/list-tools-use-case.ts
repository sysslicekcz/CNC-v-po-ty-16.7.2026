import { Tool } from "@/domain/entities/tool";
import { ToolRepository } from "@/domain/repositories/tool-repository";
import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";

export class ListToolsUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly toolRepository: ToolRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(): Promise<Tool[]> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.ToolsView, "read");
    return this.toolRepository.list(tenantId);
  }
}
