import { TenantContext } from "@/domain/services/tenant-context";
import { MachineProfileRepository } from "@/domain/calculation-engine/repositories/machine-profile-repository";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";

export interface MachineProfileSummary {
  id: string;
  label: string;
  machineCategory?: string;
  isArchived: boolean;
}

/** `ListMachineProfilesUseCase` (AP-MCE-001 Fáze H §10 "MachineProfile
 *  Selector"/§15 "MachineComparisonPage"). */
export class ListMachineProfilesUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly machineProfileRepository: MachineProfileRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(): Promise<MachineProfileSummary[]> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationRead, "read");
    const profiles = await this.machineProfileRepository.listByTenant(tenantId);
    return profiles.map((p) => ({
      id: p.id,
      label: [p.manufacturer, p.model].filter(Boolean).join(" ") || p.physicalMachineId,
      machineCategory: p.machineCategory,
      isArchived: p.isArchived,
    }));
  }
}
