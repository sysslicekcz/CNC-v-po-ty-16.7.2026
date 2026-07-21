import { TenantContext } from "@/domain/services/tenant-context";
import { CalculationStrategyRegistry } from "@/domain/calculation-engine/services/calculation-strategy-registry";
import { CalculationIssue } from "@/domain/calculation-engine/entities/types";
import { GrindingCalculationInput } from "@/domain/calculation-engine/grinding/grinding-calculation-input";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { GrindingCalculationContextBuilderPort } from "../grinding-calculation-context-builder";

/**
 * `ValidateGrindingInputUseCase` (AP-MCE-001 Fáze E §17) - jen `validate()`
 * BEZ `calculate()`/uložení, stejný důvod jako Fáze C/D. Volá
 * `CalculationStrategyRegistry.resolve("grinding")` PŘÍMO - vrátí
 * `GrindingCalculationStrategy` dispatcher, ten interně deleguje podle
 * `input.features[].subtype`.
 */
export class ValidateGrindingInputUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly strategyRegistry: CalculationStrategyRegistry,
    private readonly contextBuilder: GrindingCalculationContextBuilderPort,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(input: GrindingCalculationInput): Promise<CalculationIssue[]> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationCreate, "write");

    const context = await this.contextBuilder.build(input, tenantId);
    const strategy = this.strategyRegistry.resolve("grinding");
    return strategy.validate(input, context);
  }
}
