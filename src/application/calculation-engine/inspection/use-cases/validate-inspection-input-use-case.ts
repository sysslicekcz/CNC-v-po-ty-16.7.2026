import { TenantContext } from "@/domain/services/tenant-context";
import { CalculationStrategyRegistry } from "@/domain/calculation-engine/services/calculation-strategy-registry";
import { CalculationIssue } from "@/domain/calculation-engine/entities/types";
import { InspectionCalculationInput } from "@/domain/calculation-engine/inspection/inspection-calculation-input";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { InspectionCalculationContextBuilderPort } from "../inspection-calculation-context-builder";

/**
 * `ValidateInspectionInputUseCase` (AP-MCE-001 Fáze F §17) - jen `validate()`
 * bez `calculate()`/uložení, stejný důvod jako `ValidateManualOperation
 * InputUseCase`/Fáze C-E.
 */
export class ValidateInspectionInputUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly strategyRegistry: CalculationStrategyRegistry,
    private readonly contextBuilder: InspectionCalculationContextBuilderPort,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(input: InspectionCalculationInput): Promise<CalculationIssue[]> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationCreate, "write");

    const context = await this.contextBuilder.build(input, tenantId);
    const strategy = this.strategyRegistry.resolve("inspection");
    return strategy.validate(input, context);
  }
}
