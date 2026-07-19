import { ToolTypeRepository } from "@/domain/repositories/tool-type-repository";
import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { NotFoundError } from "@/domain/errors/not-found-error";

export class DeactivateToolTypeUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly toolTypeRepository: ToolTypeRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(id: string): Promise<void> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.ToolsManage, "write");

    const toolType = await this.toolTypeRepository.findById(id, tenantId);
    if (!toolType) throw new NotFoundError("ToolType", id);

    toolType.setStav("neaktivni");
    await this.toolTypeRepository.save(toolType);
  }
}
