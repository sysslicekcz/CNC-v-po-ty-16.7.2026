import { ToolType, ToolCategory, ToolParameterDefinition } from "@/domain/entities/tool-type";
import { ToolTypeRepository } from "@/domain/repositories/tool-type-repository";
import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { MasterDataCodeAlreadyExistsError } from "@/domain/errors/master-data-errors";
import { NotFoundError } from "@/domain/errors/not-found-error";

export interface UpdateToolTypeInput {
  kod?: string;
  nazev?: string;
  category?: ToolCategory;
  parameterDefinitions?: ToolParameterDefinition[];
  popis?: string;
}

export class UpdateToolTypeUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly toolTypeRepository: ToolTypeRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(id: string, changes: UpdateToolTypeInput): Promise<ToolType> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.ToolsManage, "write");

    const toolType = await this.toolTypeRepository.findById(id, tenantId);
    if (!toolType) throw new NotFoundError("ToolType", id);

    if (changes.kod !== undefined && changes.kod !== toolType.kod) {
      const conflict = await this.toolTypeRepository.findByCode(tenantId, changes.kod);
      if (conflict) throw new MasterDataCodeAlreadyExistsError("Typ nástroje", tenantId, changes.kod);
      toolType.changeCode(changes.kod);
    }

    if (changes.nazev !== undefined) toolType.rename(changes.nazev);

    toolType.updateDetails({
      category: changes.category,
      parameterDefinitions: changes.parameterDefinitions,
      popis: changes.popis,
    });

    await this.toolTypeRepository.save(toolType);
    return toolType;
  }
}
