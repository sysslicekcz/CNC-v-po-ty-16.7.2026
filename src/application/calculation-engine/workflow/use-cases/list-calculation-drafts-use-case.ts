import { TenantContext } from "@/domain/services/tenant-context";
import { CalculationDraftRepository } from "@/domain/calculation-engine/repositories/calculation-draft-repository";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";

/** `ListCalculationDraftsUseCase` (AP-MCE-001 Fáze H §4/§36) - "Rozpracované
 *  výpočty" (dashboard/přehled), seřazeno naposledy upravené první (viz
 *  repozitář). */
export class ListCalculationDraftsUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly draftRepository: CalculationDraftRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(): Promise<Record<string, unknown>[]> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationRead, "read");
    const drafts = await this.draftRepository.listByTenant(tenantId);
    return drafts.map((d) => d.toPlainObject());
  }
}
