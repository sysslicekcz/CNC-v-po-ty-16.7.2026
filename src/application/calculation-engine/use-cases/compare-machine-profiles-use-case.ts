import { TenantContext } from "@/domain/services/tenant-context";
import { CrossTenantAccessError } from "@/domain/calculation-engine/errors/cross-tenant-access-error";
import { MachineLimitError } from "@/domain/calculation-engine/errors/machine-limit-error";
import { CalculationIssue } from "@/domain/calculation-engine/entities/types";
import { MachineWorkEnvelopeProps } from "@/domain/calculation-engine/profiles/machine-work-envelope";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { MachineProfileResolver } from "../resolvers/machine-profile-resolver";

export interface CompareMachineProfilesInput {
  machineProfileIds: readonly string[];
  requirements: {
    requestedRpm?: number;
    requestedPowerKw?: number;
    partDimensions?: MachineWorkEnvelopeProps;
    partWeightKg?: number;
    requiredFunctionCodes?: readonly string[];
  };
}

export interface MachineProfileComparisonEntry {
  machineProfileId: string;
  profile: Record<string, unknown>;
  /** `false`, pokud stroj nesplňuje BLOKUJÍCÍ limit (otáčky/pracovní
   *  prostor/hmotnost - AP-MCE-001 §18) - `issues` pak nese jen nezávazná
   *  varování (výkon/chybějící funkce). */
  eligible: boolean;
  blockingReason?: string;
  issues: CalculationIssue[];
}

/**
 * `CompareMachineProfilesUseCase` (AP-MCE-001 Fáze B §3/§11) - "porovnat
 * jednu operaci napříč více stroji": pro každý stroj spočítá, jestli operaci
 * vůbec zvládne (`MachineProfile.assertWithinLimits`), BEZ přerušení
 * porovnání kvůli jednomu nevyhovujícímu stroji - blokující chyba jednoho
 * stroje se převede na `eligible: false`, ne na vyhozenou výjimku z celého
 * use casu. Analytická operace - vyžaduje jen `calculation.read` (§12).
 */
export class CompareMachineProfilesUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly resolver: MachineProfileResolver,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(input: CompareMachineProfilesInput): Promise<MachineProfileComparisonEntry[]> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationRead, "read");

    const resolvedMachines = await this.resolver.resolveMany(input.machineProfileIds, tenantId);

    return resolvedMachines.map(({ resolved, system }) => {
      if (system.tenantId !== tenantId) throw new CrossTenantAccessError("MachineProfile", resolved.id, tenantId);

      try {
        const issues = resolved.assertWithinLimits(input.requirements);
        return { machineProfileId: resolved.id, profile: resolved.toPlainObject(), eligible: true, issues };
      } catch (error) {
        if (error instanceof MachineLimitError) {
          return {
            machineProfileId: resolved.id,
            profile: resolved.toPlainObject(),
            eligible: false,
            blockingReason: error.message,
            issues: [],
          };
        }
        throw error;
      }
    });
  }
}
