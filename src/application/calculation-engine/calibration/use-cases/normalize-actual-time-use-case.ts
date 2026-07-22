import { TenantContext } from "@/domain/services/tenant-context";
import { ActualTimeRecordRepository } from "@/domain/calculation-engine/repositories/actual-time-record-repository";
import { ActualTimeSegmentRepository } from "@/domain/calculation-engine/repositories/actual-time-segment-repository";
import { resolveTimeOverlaps } from "@/domain/calculation-engine/calibration/time-overlap-resolver";
import { normalizeActualTime, NormalizedActualTime } from "@/domain/calculation-engine/calibration/actual-time-normalizer";
import { CalculationError } from "@/domain/calculation-engine/errors/calculation-error";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";

export interface NormalizeActualTimeInput {
  actualTimeRecordId: string;
}

/** `NormalizeActualTimeUseCase` (AP-MCE-001 Fáze G §7/§22) - čtecí use case
 *  (žádná mutace/událost) - sestaví `TimeOverlapResolution` ze segmentů
 *  (pokud existují) a předá `normalizeActualTime()` (Domain, čisté). */
export class NormalizeActualTimeUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly repository: ActualTimeRecordRepository,
    private readonly segmentRepository: ActualTimeSegmentRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(input: NormalizeActualTimeInput): Promise<NormalizedActualTime> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationActualTimeRead, "read");

    const record = await this.repository.getById(input.actualTimeRecordId, tenantId);
    if (!record) throw new CalculationError(`ActualTimeRecord "${input.actualTimeRecordId}" nebyl nalezen.`);

    const segments = await this.segmentRepository.listByActualTimeRecord(record.id);
    const overlapResolution = segments.length > 0 ? resolveTimeOverlaps(segments) : undefined;

    return normalizeActualTime(record, overlapResolution);
  }
}
