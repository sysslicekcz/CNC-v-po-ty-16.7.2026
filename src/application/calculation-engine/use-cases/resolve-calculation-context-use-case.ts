import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { CalculationContext } from "@/domain/calculation-engine/contracts/calculation-context";
import { CalculationContextResolver, ResolveCalculationContextInput } from "../resolvers/calculation-context-resolver";

export type { ResolveCalculationContextInput };

/**
 * `ResolveCalculationContextUseCase` (AP-MCE-001 Fáze B §11) - tenký obal nad
 * `CalculationContextResolver` (Application resolver, §6): přidává jen
 * licenční kontrolu (§12 - "použití profilu ve výpočtu" vyžaduje
 * `calculation.create`) a tenant-scoping z `TenantContext`, samotné sestavení
 * kontextu (snapshoty, řezné podmínky, verze pravidel) dělá resolver.
 * `CalculateOperationUseCase` (Fáze A) tenhle use case zavolá MÍSTO toho, aby
 * si `CalculationContext` sestavoval sám, jakmile začne registrovat
 * konkrétní strategie (Fáze C+).
 */
export class ResolveCalculationContextUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly resolver: CalculationContextResolver,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(input: Omit<ResolveCalculationContextInput, "tenantId">): Promise<CalculationContext> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationCreate, "write");

    return this.resolver.resolve({ ...input, tenantId });
  }
}
