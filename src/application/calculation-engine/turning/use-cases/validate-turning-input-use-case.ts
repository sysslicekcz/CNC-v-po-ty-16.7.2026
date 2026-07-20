import { TenantContext } from "@/domain/services/tenant-context";
import { CalculationStrategyRegistry } from "@/domain/calculation-engine/services/calculation-strategy-registry";
import { CalculationIssue } from "@/domain/calculation-engine/entities/types";
import { TurningCalculationInput } from "@/domain/calculation-engine/turning/turning-calculation-input";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { TurningCalculationContextBuilder } from "../turning-calculation-context-builder";

/**
 * `ValidateTurningInputUseCase` (AP-MCE-001 Fáze C §14) - jen `validate()`
 * BEZ `calculate()`/uložení - použití: náhled v editoru technologie ("dala
 * by se tahle operace vůbec spočítat?") předtím, než se spustí celý výpočet
 * (stejný důvod jako Fáze B `ResolveCuttingConditionsUseCase`). Volá
 * `CalculationStrategyRegistry.resolve("turning")` PŘÍMO (ne přes
 * `CalculationEngine`, ten `validate()` samostatně nevystavuje) - pořád
 * stejná registrovaná strategie, jen jiný vstupní bod.
 */
export class ValidateTurningInputUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly strategyRegistry: CalculationStrategyRegistry,
    private readonly contextBuilder: TurningCalculationContextBuilder,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(input: TurningCalculationInput): Promise<CalculationIssue[]> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationCreate, "write");

    const context = await this.contextBuilder.build(input, tenantId);
    const strategy = this.strategyRegistry.resolve("turning");
    return strategy.validate(input, context);
  }
}
