import { ToolMachineCondition, MachiningMode, CuttingConditionSource } from "@/domain/entities/tool-machine-condition";
import { CuttingParameters } from "@/domain/value-objects/cutting-parameters";
import { ToolMachineConditionRepository } from "@/domain/repositories/tool-machine-condition-repository";
import { ToolRepository } from "@/domain/repositories/tool-repository";
import { MachineRepository } from "@/domain/repositories/machine-repository";
import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { NotFoundError } from "@/domain/errors/not-found-error";
import { InvalidMasterDataValueError } from "@/domain/errors/master-data-errors";

export interface CreateToolMachineConditionInput {
  toolId: string;
  machineId: string;
  parameters: CuttingParameters;
  operationTypeId?: string;
  materialId?: string;
  machiningMode?: MachiningMode;
  priority?: number;
  source?: CuttingConditionSource;
  note?: string;
}

/** Založení profilu řezných podmínek (Krok 5, zadání bod 20/38) - ověří, že
 *  nástroj i stroj skutečně existují v rámci tenanta. Materiál/typ operace
 *  jsou nepovinné zpřesnění (`resolveCuttingConditions` je pak umí zohlednit). */
export class CreateToolMachineConditionUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly conditionRepository: ToolMachineConditionRepository,
    private readonly toolRepository: ToolRepository,
    private readonly machineRepository: MachineRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(input: CreateToolMachineConditionInput): Promise<ToolMachineCondition> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CuttingConditionsManage, "write");

    const tool = await this.toolRepository.findById(input.toolId, tenantId);
    if (!tool) throw new NotFoundError("Tool", input.toolId);
    const machine = await this.machineRepository.findById(input.machineId, tenantId);
    if (!machine) throw new NotFoundError("Machine", input.machineId);

    if (input.priority !== undefined && input.priority < 0) {
      throw new InvalidMasterDataValueError("Priorita nesmí být záporná.");
    }

    const condition = ToolMachineCondition.create({
      id: crypto.randomUUID(),
      tenantId,
      toolId: input.toolId,
      machineId: input.machineId,
      parameters: input.parameters,
      stav: "aktivni",
      operationTypeId: input.operationTypeId,
      materialId: input.materialId,
      machiningMode: input.machiningMode,
      priority: input.priority,
      source: input.source,
      note: input.note,
    });
    await this.conditionRepository.save(condition);
    return condition;
  }
}
