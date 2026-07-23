import { TenantContext } from "@/domain/services/tenant-context";
import { ActualTimeRecordRepository } from "@/domain/calculation-engine/repositories/actual-time-record-repository";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import type { OperationCategory } from "@/domain/calculation-engine/enums/operation-category";
import type { ActualTimeStatus, ActualTimeSourceType } from "@/domain/calculation-engine/calibration/actual-time-enums";

export interface ActualTimeRecordSummary {
  id: string;
  operationCategory: OperationCategory;
  calculationId?: string;
  status: ActualTimeStatus;
  sourceType: ActualTimeSourceType;
  quantityCompleted: number;
  totalElapsedTimeMin?: number;
  confidence: number;
  recordedAt: string;
}

/** `ListActualTimeRecordsUseCase` (AP-MCE-001 Fáze H §20 "ActualTimesPage") -
 *  Application vrstva dosud neměla žádný VÝPISOVÝ use case nad
 *  `ActualTimeRecordRepository.listByTenant` (jen interní volání z Fáze G
 *  matcheru/kalibrace) - stejný důvod jako `ListCalculationResultsUseCase`. */
export class ListActualTimeRecordsUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly actualTimeRecordRepository: ActualTimeRecordRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(): Promise<ActualTimeRecordSummary[]> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationActualTimeRead, "read");
    const records = await this.actualTimeRecordRepository.listByTenant(tenantId);
    return records
      .map((r) => ({
        id: r.id,
        operationCategory: r.operationCategory,
        calculationId: r.calculationId,
        status: r.status,
        sourceType: r.sourceType,
        quantityCompleted: r.quantityCompleted,
        totalElapsedTimeMin: r.totalElapsedTimeMin,
        confidence: r.confidence,
        recordedAt: r.recordedAt,
      }))
      .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
  }
}
