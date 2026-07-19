import { ToolType, ToolCategory, ToolParameterDefinition } from "@/domain/entities/tool-type";
import { ToolTypeRepository } from "@/domain/repositories/tool-type-repository";
import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { MasterDataCodeAlreadyExistsError } from "@/domain/errors/master-data-errors";

export interface CreateToolTypeInput {
  kod: string;
  nazev: string;
  category: ToolCategory;
  parameterDefinitions?: ToolParameterDefinition[];
  popis?: string;
}

export class CreateToolTypeUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly toolTypeRepository: ToolTypeRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(input: CreateToolTypeInput): Promise<ToolType> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.ToolsManage, "write");

    const existing = await this.toolTypeRepository.findByCode(tenantId, input.kod);
    if (existing) throw new MasterDataCodeAlreadyExistsError("Typ nástroje", tenantId, input.kod);

    const toolType = ToolType.create({
      id: crypto.randomUUID(),
      tenantId,
      kod: input.kod,
      nazev: input.nazev,
      category: input.category,
      parameterDefinitions: input.parameterDefinitions ?? [],
      stav: "aktivni",
      popis: input.popis,
    });
    await this.toolTypeRepository.save(toolType);
    return toolType;
  }
}
