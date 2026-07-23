import { TenantContext } from "@/domain/services/tenant-context";
import { ActualTimeImportBatchRepository } from "@/domain/calculation-engine/repositories/actual-time-import-batch-repository";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";

/** `ListActualTimeImportMappingsUseCase` (AP-MCE-001 Fáze H §20
 *  "ActualTimeImportWizard" krok "výběr mapování"). */
export class ListActualTimeImportMappingsUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly importBatchRepository: ActualTimeImportBatchRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(): Promise<Record<string, unknown>[]> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationActualTimeRead, "read");
    const mappings = await this.importBatchRepository.listMappingsByTenant(tenantId);
    return mappings.map((m) => m.toPlainObject());
  }
}
