import { CuttingParameters } from "@/domain/value-objects/cutting-parameters";
import { ToolRepository } from "@/domain/repositories/tool-repository";
import { ToolMachineConditionRepository } from "@/domain/repositories/tool-machine-condition-repository";
import { resolveCuttingConditions } from "@/domain/services/cutting-condition-resolver";
import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { NotFoundError } from "@/domain/errors/not-found-error";

export interface ResolveCuttingConditionRequest {
  toolId: string;
  machineId: string;
  operationTypeId?: string;
  materialId?: string;
}

/**
 * Application obálka nad čistým doménovým resolverem (Krok 5, zadání bod 21) -
 * dotáhne nástroj + JEN AKTIVNÍ profily pro daný stroj, zbytek nechá na
 * `resolveCuttingConditions`. Editor technologického postupu (Krok 4) tenhle
 * use case v tomto kroku ještě nevolá automaticky (zůstává explicitní akce
 * přes budoucí UI tlačítko "Načíst doporučené podmínky") - viz
 * docs/step-5/known-limitations.md.
 */
export class ResolveCuttingConditionUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly toolRepository: ToolRepository,
    private readonly conditionRepository: ToolMachineConditionRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(request: ResolveCuttingConditionRequest): Promise<CuttingParameters> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CuttingConditionsView, "read");

    const tool = await this.toolRepository.findById(request.toolId, tenantId);
    if (!tool) throw new NotFoundError("Tool", request.toolId);

    const profiles = (await this.conditionRepository.findByToolAndMachine(request.toolId, request.machineId, tenantId)).filter(
      (p) => p.stav === "aktivni"
    );

    return resolveCuttingConditions(tool, profiles, {
      operationTypeId: request.operationTypeId,
      materialId: request.materialId,
    });
  }
}
