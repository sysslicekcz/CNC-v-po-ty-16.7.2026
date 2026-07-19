import { ToolMachineConditionRepository } from "@/domain/repositories/tool-machine-condition-repository";
import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { NotFoundError } from "@/domain/errors/not-found-error";

export class DeactivateToolMachineConditionUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly conditionRepository: ToolMachineConditionRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(id: string): Promise<void> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CuttingConditionsManage, "write");

    const condition = await this.conditionRepository.findById(id, tenantId);
    if (!condition) throw new NotFoundError("ToolMachineCondition", id);

    condition.setStav("neaktivni");
    await this.conditionRepository.save(condition);
  }
}
