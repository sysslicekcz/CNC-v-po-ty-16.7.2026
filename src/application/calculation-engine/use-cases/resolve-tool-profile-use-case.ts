import { TenantContext } from "@/domain/services/tenant-context";
import { CrossTenantAccessError } from "@/domain/calculation-engine/errors/cross-tenant-access-error";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { ToolProfileResolver } from "../resolvers/tool-profile-resolver";

export interface ResolveToolProfileInput {
  toolProfileId: string;
}

/** `ResolveToolProfileUseCase` (AP-MCE-001 Fáze B §11) - viz `Resolve
 *  MaterialProfileUseCase` pro plné zdůvodnění vzoru. Vyžaduje
 *  `calculation.create` (§12). */
export class ResolveToolProfileUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly resolver: ToolProfileResolver,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(input: ResolveToolProfileInput): Promise<Record<string, unknown>> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationCreate, "write");

    const { resolved, system } = await this.resolver.resolve(input.toolProfileId, tenantId);
    if (system.tenantId !== tenantId) throw new CrossTenantAccessError("ToolProfile", input.toolProfileId, tenantId);

    return resolved.toPlainObject();
  }
}
