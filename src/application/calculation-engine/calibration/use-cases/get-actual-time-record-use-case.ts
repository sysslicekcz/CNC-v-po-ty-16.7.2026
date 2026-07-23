import { TenantContext } from "@/domain/services/tenant-context";
import { ActualTimeRecordRepository } from "@/domain/calculation-engine/repositories/actual-time-record-repository";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";

/** `GetActualTimeRecordUseCase` (AP-MCE-001 Fáze H §20 "ActualTimeDetail
 *  Page") - plochá projekce jednoho `ActualTimeRecord` (`toPlainObject()`,
 *  stejný vzor jako `CalculationDraft`), pro obrazovku, kde se hodí VŠECHNA
 *  pole, ne jen odlehčený souhrn jako v `ListActualTimeRecordsUseCase`. */
export class GetActualTimeRecordUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly actualTimeRecordRepository: ActualTimeRecordRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(id: string): Promise<Record<string, unknown> | null> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationActualTimeRead, "read");
    const record = await this.actualTimeRecordRepository.getById(id, tenantId);
    return record ? record.toPlainObject() : null;
  }
}
