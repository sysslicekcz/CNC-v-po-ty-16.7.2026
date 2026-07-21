import { TenantContext } from "@/domain/services/tenant-context";
import { CalculationStrategyRegistry } from "@/domain/calculation-engine/services/calculation-strategy-registry";
import { CalculationIssue } from "@/domain/calculation-engine/entities/types";
import { ManualOperationCalculationInput } from "@/domain/calculation-engine/manual/manual-operation-calculation-input";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { ManualOperationCalculationContextBuilderPort } from "../manual-operation-calculation-context-builder";

/**
 * `ValidateManualOperationInputUseCase` (AP-MCE-001 Fáze F §17) - jen
 * `validate()` bez `calculate()`/uložení, stejný důvod jako Fáze C/D/E
 * `ValidateXInputUseCase` (náhled v editoru technologie).
 */
export class ValidateManualOperationInputUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly strategyRegistry: CalculationStrategyRegistry,
    private readonly contextBuilder: ManualOperationCalculationContextBuilderPort,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(input: ManualOperationCalculationInput): Promise<CalculationIssue[]> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationCreate, "write");

    const context = await this.contextBuilder.build(input, tenantId);
    const strategy = this.strategyRegistry.resolve("manual");
    return strategy.validate(input, context);
  }
}
