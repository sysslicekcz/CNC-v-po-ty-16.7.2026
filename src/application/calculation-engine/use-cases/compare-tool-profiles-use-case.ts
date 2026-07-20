import { TenantContext } from "@/domain/services/tenant-context";
import { CrossTenantAccessError } from "@/domain/calculation-engine/errors/cross-tenant-access-error";
import { InvalidToolLifeError } from "@/domain/calculation-engine/errors/invalid-tool-life-error";
import { CalculationIssue } from "@/domain/calculation-engine/entities/types";
import { ToolMaterialCompatibilityService } from "@/domain/calculation-engine/profiles/tool-material-compatibility-service";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { ToolProfileResolver } from "../resolvers/tool-profile-resolver";

export interface CompareToolProfilesInput {
  toolProfileIds: readonly string[];
  materialGroupId?: string;
  /** Kolik kusů se bude obrábět - pokud je zadané, spočte se pro každý
   *  nástroj i `expectedToolChanges` (AP-MCE-001 Fáze B §4). */
  quantity?: number;
  estimatedUnitTimeMinutes?: number;
}

export interface ToolProfileComparisonEntry {
  toolProfileId: string;
  profile: Record<string, unknown>;
  issues: CalculationIssue[];
  expectedToolChanges?: number;
}

/**
 * `CompareToolProfilesUseCase` (AP-MCE-001 Fáze B §4/§11) - porovná nástroje
 * pro danou materiálovou skupinu/dávku: vhodnost (`ToolMaterialCompatibility
 * Service`, warning, ne blokující chyba) a očekávaný počet výměn nástroje
 * (`ToolLifeProfile.expectedToolChanges`). Analytická operace - vyžaduje jen
 * `calculation.read` (§12).
 */
export class CompareToolProfilesUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly resolver: ToolProfileResolver,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(input: CompareToolProfilesInput): Promise<ToolProfileComparisonEntry[]> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationRead, "read");

    if (input.quantity !== undefined && (!Number.isFinite(input.quantity) || input.quantity <= 0)) {
      throw new InvalidToolLifeError("*", `'quantity' musí být kladné číslo, dostal jsem "${input.quantity}".`);
    }

    const resolvedTools = await this.resolver.resolveMany(input.toolProfileIds, tenantId);

    return resolvedTools.map(({ resolved, system }) => {
      if (system.tenantId !== tenantId) throw new CrossTenantAccessError("ToolProfile", resolved.id, tenantId);

      const issues = input.materialGroupId ? ToolMaterialCompatibilityService.check(resolved, input.materialGroupId) : [];
      const expectedToolChanges =
        input.quantity !== undefined ? resolved.toolLife.expectedToolChanges(input.quantity, input.estimatedUnitTimeMinutes) : undefined;

      return { toolProfileId: resolved.id, profile: resolved.toPlainObject(), issues, expectedToolChanges };
    });
  }
}
