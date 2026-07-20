import { TenantContext } from "@/domain/services/tenant-context";
import { CrossTenantAccessError } from "@/domain/calculation-engine/errors/cross-tenant-access-error";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { MachineProfileResolver } from "../resolvers/machine-profile-resolver";

export interface ResolveMachineProfileInput {
  machineProfileId: string;
}

/** `ResolveMachineProfileUseCase` (AP-MCE-001 Fáze B §11) - viz `Resolve
 *  MaterialProfileUseCase` pro plné zdůvodnění vzoru. Vyžaduje
 *  `calculation.create` (§12). */
export class ResolveMachineProfileUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly resolver: MachineProfileResolver,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(input: ResolveMachineProfileInput): Promise<Record<string, unknown>> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationCreate, "write");

    const { resolved, system } = await this.resolver.resolve(input.machineProfileId, tenantId);
    if (system.tenantId !== tenantId) throw new CrossTenantAccessError("MachineProfile", input.machineProfileId, tenantId);

    return resolved.toPlainObject();
  }
}
