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

export interface CreateToolInput {
  code?: string;
  nazev: string;
  toolTypeId: string;
  manufacturer?: string;
  designation?: string;
  parameters?: Record<string, ToolParameterValue>;
  radius?: number;
  defaultCuttingParameters?: CuttingParameters;
  poznamka?: string;
}

/** Založení nástroje (Krok 5, zadání bod 17) - `parameters` se validují proti
 *  `ToolType.parameterDefinitions` (povinnost, typ, `allowedValues`) PŘED
 *  uložením, ne až při použití v editoru postupu. */
export class CreateToolUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly toolRepository: ToolRepository,
    private readonly toolTypeRepository: ToolTypeRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(input: CreateToolInput): Promise<Tool> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.ToolsManage, "write");

    const currentCount = (await this.toolRepository.list(tenantId)).length;
    await this.featureAccessService.assertWithinLimit("tools.max", currentCount + 1);

    const toolType = await this.toolTypeRepository.findById(input.toolTypeId, tenantId);
    if (!toolType) throw new NotFoundError("ToolType", input.toolTypeId);
    if (toolType.stav !== "aktivni") throw new MasterDataInactiveError("Typ nástroje", input.toolTypeId);

    const errors = validateToolParameters(toolType.parameterDefinitions, input.parameters ?? {});
    if (errors.length > 0) throw new InvalidMasterDataValueError(errors.join(" "));

    let code: ToolCode | undefined;
    if (input.code) {
      code = ToolCode.create(input.code);
      const existing = await this.toolRepository.findByCode(tenantId, code);
      if (existing) throw new MasterDataCodeAlreadyExistsError("Nástroj", tenantId, code.toString());
    }

    const tool = Tool.create({
      id: crypto.randomUUID(),
      tenantId,
      code,
      nazev: input.nazev,
      toolTypeId: input.toolTypeId,
      manufacturer: input.manufacturer,
      designation: input.designation,
      parameters: input.parameters,
      stav: "aktivni",
      radius: input.radius,
      defaultCuttingParameters: input.defaultCuttingParameters,
      poznamka: input.poznamka,
    });
    await this.toolRepository.save(tool);
    return tool;
  }
}
