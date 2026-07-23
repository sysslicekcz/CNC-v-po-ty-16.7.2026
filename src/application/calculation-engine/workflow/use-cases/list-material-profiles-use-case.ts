import { TenantContext } from "@/domain/services/tenant-context";
import { MaterialProfileRepository } from "@/domain/calculation-engine/repositories/material-profile-repository";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";

export interface MaterialProfileSummary {
  id: string;
  label: string;
  materialGroupName: string;
  isArchived: boolean;
}

/** `ListMaterialProfilesUseCase` (AP-MCE-001 Fáze H §10 "MaterialProfile
 *  Selector") - odlehčený výpis pro výběrník, ne plný `MaterialProfile`
 *  (stejný důvod jako `CalculationSummary` u výsledků - výpisová obrazovka
 *  nepotřebuje celý profil). */
export class ListMaterialProfilesUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly materialProfileRepository: MaterialProfileRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(): Promise<MaterialProfileSummary[]> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationRead, "read");
    const profiles = await this.materialProfileRepository.listByTenant(tenantId);
    return profiles.map((p) => ({
      id: p.id,
      label: `${p.name}${p.standard ? ` (${p.standard})` : ""}`,
      materialGroupName: p.materialGroupName,
      isArchived: p.isArchived,
    }));
  }
}
