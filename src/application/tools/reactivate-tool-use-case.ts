import { ToolRepository } from "@/domain/repositories/tool-repository";
import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { NotFoundError } from "@/domain/errors/not-found-error";

export class ReactivateToolUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly toolRepository: ToolRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(id: string): Promise<void> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.ToolsManage, "write");

    const tool = await this.toolRepository.findById(id, tenantId);
    if (!tool) throw new NotFoundError("Tool", id);

    tool.setStav("aktivni");
    await this.toolRepository.save(tool);
  }
}
