import { TenantContext } from "@/domain/services/tenant-context";
import { CalculationStrategyRegistry } from "@/domain/calculation-engine/services/calculation-strategy-registry";
import { CalculationIssue } from "@/domain/calculation-engine/entities/types";
import { MillingCalculationInput } from "@/domain/calculation-engine/milling/milling-calculation-input";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { MillingCalculationContextBuilderPort } from "../milling-calculation-context-builder";

/**
 * `ValidateMillingInputUseCase` (AP-MCE-001 Fáze D §15) - jen `validate()`
 * BEZ `calculate()`/uložení, stejný důvod jako Fáze C
 * `ValidateTurningInputUseCase`. Volá `CalculationStrategyRegistry.resolve
 * ("milling")` PŘÍMO.
 */
export class ValidateMillingInputUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly strategyRegistry: CalculationStrategyRegistry,
    private readonly contextBuilder: MillingCalculationContextBuilderPort,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(input: MillingCalculationInput): Promise<CalculationIssue[]> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationCreate, "write");

    const context = await this.contextBuilder.build(input, tenantId);
    const strategy = this.strategyRegistry.resolve("milling");
    return strategy.validate(input, context);
  }
}
