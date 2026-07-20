import { TenantContext } from "@/domain/services/tenant-context";
import { CrossTenantAccessError } from "@/domain/calculation-engine/errors/cross-tenant-access-error";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { MaterialProfileResolver } from "../resolvers/material-profile-resolver";

export interface ResolveMaterialProfileInput {
  materialProfileId: string;
}

/** `ResolveMaterialProfileUseCase` (AP-MCE-001 Fáze B §11) - tenký obal nad
 *  `MaterialProfileResolver` (Application resolver) - přidává jen licenční
 *  kontrolu (§12: použití profilu ve výpočtu vyžaduje `calculation.create`)
 *  a tenant-scoping. Vrací "resolved" profil (systém + korekce), NE
 *  samostatně systém a korekci zvlášť. */
export class ResolveMaterialProfileUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly resolver: MaterialProfileResolver,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(input: ResolveMaterialProfileInput): Promise<Record<string, unknown>> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationCreate, "write");

    const { resolved, system } = await this.resolver.resolve(input.materialProfileId, tenantId);
    if (system.tenantId !== tenantId) throw new CrossTenantAccessError("MaterialProfile", input.materialProfileId, tenantId);

    return resolved.toPlainObject();
  }
}
