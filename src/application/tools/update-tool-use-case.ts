import { Tool, ToolParameterValue } from "@/domain/entities/tool";
import { ToolCode } from "@/domain/value-objects/tool-code";
import { CuttingParameters } from "@/domain/value-objects/cutting-parameters";
import { ToolRepository } from "@/domain/repositories/tool-repository";
import { ToolTypeRepository } from "@/domain/repositories/tool-type-repository";
import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { MasterDataCodeAlreadyExistsError, InvalidMasterDataValueError, MasterDataInactiveError } from "@/domain/errors/master-data-errors";
import { NotFoundError } from "@/domain/errors/not-found-error";
import { validateToolParameters } from "./validate-tool-parameters";

export interface UpdateToolInput {
  code?: string | null;
  nazev?: string;
  toolTypeId?: string;
  manufacturer?: string;
  designation?: string;
  parameters?: Record<string, ToolParameterValue>;
  radius?: number;
  defaultCuttingParameters?: CuttingParameters;
  poznamka?: string;
}

/** `changes.toolTypeId` může přepnout typ nástroje - staré `parameters`
 *  NEZAHAZUJE automaticky (zadání bod 37 - "nemaž hodnoty bez potvrzení"),
 *  jen je znovu zvaliduje proti definicím NOVÉHO typu. Pokud volající chce
 *  hodnoty vyprázdnit, pošle `parameters: {}` explicitně ve stejném volání. */
export class UpdateToolUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly toolRepository: ToolRepository,
    private readonly toolTypeRepository: ToolTypeRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(id: string, changes: UpdateToolInput): Promise<Tool> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.ToolsManage, "write");

    const tool = await this.toolRepository.findById(id, tenantId);
    if (!tool) throw new NotFoundError("Tool", id);

    if (changes.code !== undefined) {
      if (changes.code === null) {
        tool.changeCode(undefined);
      } else {
        const newCode = ToolCode.create(changes.code);
        if (!tool.code || !newCode.equals(tool.code)) {
          const conflict = await this.toolRepository.findByCode(tenantId, newCode);
          if (conflict) throw new MasterDataCodeAlreadyExistsError("Nástroj", tenantId, newCode.toString());
          tool.changeCode(newCode);
        }
      }
    }

    const effectiveToolTypeId = changes.toolTypeId ?? tool.toolTypeId;
    const toolType = await this.toolTypeRepository.findById(effectiveToolTypeId, tenantId);
    if (!toolType) throw new NotFoundError("ToolType", effectiveToolTypeId);
    if (toolType.stav !== "aktivni" && changes.toolTypeId !== undefined) {
      throw new MasterDataInactiveError("Typ nástroje", effectiveToolTypeId);
    }

    const effectiveParameters = changes.parameters ?? tool.parameters ?? {};
    const errors = validateToolParameters(toolType.parameterDefinitions, effectiveParameters);
    if (errors.length > 0) throw new InvalidMasterDataValueError(errors.join(" "));

    if (changes.toolTypeId !== undefined) tool.changeToolType(changes.toolTypeId);
    if (changes.nazev !== undefined) tool.rename(changes.nazev);

    tool.updateDetails({
      manufacturer: changes.manufacturer,
      designation: changes.designation,
      parameters: changes.parameters,
      radius: changes.radius,
      defaultCuttingParameters: changes.defaultCuttingParameters,
      poznamka: changes.poznamka,
    });

    await this.toolRepository.save(tool);
    return tool;
  }
}
