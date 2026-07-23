import { TenantContext } from "@/domain/services/tenant-context";
import { ToolProfileRepository } from "@/domain/calculation-engine/repositories/tool-profile-repository";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";

export interface ToolProfileSummary {
  id: string;
  label: string;
  isArchived: boolean;
}

/** `ListToolProfilesUseCase` (AP-MCE-001 Fáze H §10 "ToolProfileSelector"/
 *  §16 "ToolComparisonPage"). */
export class ListToolProfilesUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly toolProfileRepository: ToolProfileRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(): Promise<ToolProfileSummary[]> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationRead, "read");
    const profiles = await this.toolProfileRepository.listByTenant(tenantId);
    return profiles.map((p) => ({
      id: p.id,
      label: [p.toolTypeName, p.catalogDesignation].filter(Boolean).join(" - "),
      isArchived: p.isArchived,
    }));
  }
}
