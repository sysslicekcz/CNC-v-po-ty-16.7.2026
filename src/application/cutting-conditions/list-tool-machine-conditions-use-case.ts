import { ToolMachineCondition } from "@/domain/entities/tool-machine-condition";
import { ToolMachineConditionRepository } from "@/domain/repositories/tool-machine-condition-repository";
import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";

export class ListToolMachineConditionsUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly conditionRepository: ToolMachineConditionRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(): Promise<ToolMachineCondition[]> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CuttingConditionsView, "read");
    return this.conditionRepository.list(tenantId);
  }
}
