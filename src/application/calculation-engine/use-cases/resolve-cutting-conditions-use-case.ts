import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { CuttingConditionResolution } from "@/domain/calculation-engine/cutting-conditions/cutting-condition-resolver";
import {
  CuttingConditionResolverService,
  ResolveCuttingConditionsForContextInput,
} from "../resolvers/cutting-condition-resolver-service";

export type ResolveCuttingConditionsInput = Omit<ResolveCuttingConditionsForContextInput, "tenantId">;

/**
 * `ResolveCuttingConditionsUseCase` (AP-MCE-001 Fáze B §5/§11) - samostatný
 * use case pro dotaz "jaké řezné podmínky by se použily", BEZ nutnosti
 * sestavovat celý `CalculationContext` (viz `ResolveCalculationContextUseCase`
 * pro plný kontext výpočtu) - použití: náhled/kontrola v editoru technologie
 * ještě předtím, než se spustí celý výpočet. Vyžaduje `calculation.create`
 * (§12 - "použití profilu ve výpočtu").
 *
 * ČISTĚ ČTECÍ operace (nic se neukládá) - nevyvolává `cutting_condition.
 * created`/`updated` (§13 - ty patří `SaveCuttingConditionUseCase`, který
 * skutečně persistuje nový/změněný záznam).
 */
export class ResolveCuttingConditionsUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly cuttingConditionResolverService: CuttingConditionResolverService,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(input: ResolveCuttingConditionsInput): Promise<CuttingConditionResolution> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationCreate, "write");

    const now = new Date().toISOString();
    const { resolution } = await this.cuttingConditionResolverService.resolve({ ...input, tenantId }, now);
    return resolution;
  }
}
