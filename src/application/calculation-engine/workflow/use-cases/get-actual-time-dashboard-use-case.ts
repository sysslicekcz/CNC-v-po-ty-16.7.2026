import { TenantContext } from "@/domain/services/tenant-context";
import { ActualTimeRecordRepository } from "@/domain/calculation-engine/repositories/actual-time-record-repository";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";

export interface ActualTimeDashboardSummary {
  totalCount: number;
  draftCount: number;
  approvedCount: number;
  /** Počet záznamů BEZ `calculationId` (§6 "unmatched") - `ActualTimeRecord`
   *  netrackuje samostatný "match_failed" stav (to je přechodný výstup
   *  `ActualTimeCalculationMatcher`, ne uložené pole), proto tenhle jediný
   *  čítač pokrývá "čeká na spárování". */
  unmatchedCount: number;
  bySourceType: Readonly<Record<string, number>>;
}

/** `GetActualTimeDashboardQuery` (AP-MCE-001 Fáze H §20/§36) - čtecí
 *  agregace nad `ActualTimeRecordRepository` (žádná nová doménová logika). */
export class GetActualTimeDashboardUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly actualTimeRecordRepository: ActualTimeRecordRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(): Promise<ActualTimeDashboardSummary> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationActualTimeRead, "read");

    const records = await this.actualTimeRecordRepository.listByTenant(tenantId);
    const bySourceType: Record<string, number> = {};
    for (const record of records) {
      bySourceType[record.sourceType] = (bySourceType[record.sourceType] ?? 0) + 1;
    }

    return {
      totalCount: records.length,
      draftCount: records.filter((r) => r.status === "draft").length,
      approvedCount: records.filter((r) => r.status === "approved").length,
      unmatchedCount: records.filter((r) => r.calculationId === undefined).length,
      bySourceType,
    };
  }
}
