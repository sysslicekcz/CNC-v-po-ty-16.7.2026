import { TenantContext } from "@/domain/services/tenant-context";
import { ActualTimeRecordRepository } from "@/domain/calculation-engine/repositories/actual-time-record-repository";
import { ActualTimeSegmentRepository } from "@/domain/calculation-engine/repositories/actual-time-segment-repository";
import { resolveTimeOverlaps } from "@/domain/calculation-engine/calibration/time-overlap-resolver";
import { CalculationIssue } from "@/domain/calculation-engine/entities/types";
import { calibrationIssue } from "@/domain/calculation-engine/calibration/calibration-issue-codes";
import { CalculationError } from "@/domain/calculation-engine/errors/calculation-error";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { DomainEventPublisher } from "@/domain/calculation-engine/events/domain-event-publisher";
import { buildCalculationEngineEvent } from "@/domain/calculation-engine/events/build-calculation-engine-event";

export interface ValidateActualTimeRecordInput {
  actualTimeRecordId: string;
  actorId?: string;
  correlationId?: string;
}

export interface ValidateActualTimeRecordOutput {
  issues: CalculationIssue[];
  status: "validated" | "rejected";
}

/**
 * `ValidateActualTimeRecordUseCase` (AP-MCE-001 Fáze G §22) - zavolá
 * `TimeOverlapResolver` (§4) nad segmenty záznamu (pokud existují) a ověří
 * základní invarianty (§26 kódy) - žádná chyba se `severity: "error"`
 * posune status na `"validated"`, jinak na `"rejected"`.
 */
export class ValidateActualTimeRecordUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly repository: ActualTimeRecordRepository,
    private readonly segmentRepository: ActualTimeSegmentRepository,
    private readonly featureAccessService: FeatureAccessService,
    private readonly eventPublisher: DomainEventPublisher
  ) {}

  async execute(input: ValidateActualTimeRecordInput): Promise<ValidateActualTimeRecordOutput> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationActualTimeEdit, "write");

    const record = await this.repository.getById(input.actualTimeRecordId, tenantId);
    if (!record) throw new CalculationError(`ActualTimeRecord "${input.actualTimeRecordId}" nebyl nalezen.`);

    const issues: CalculationIssue[] = [];
    if (record.quantityCompleted === 0) {
      issues.push(calibrationIssue("QUANTITY_COMPLETED_ZERO", "'quantityCompleted' je nula."));
    }
    if (record.productionStartedAt && record.productionFinishedAt && record.productionStartedAt > record.productionFinishedAt) {
      issues.push(calibrationIssue("INVALID_TIME_RANGE", "'productionStartedAt' je po 'productionFinishedAt'."));
    }

    const segments = await this.segmentRepository.listByActualTimeRecord(record.id);
    if (segments.length > 0) {
      const overlap = resolveTimeOverlaps(segments);
      issues.push(...overlap.warnings);
      if (overlap.unresolvedOverlapMin > 0) {
        issues.push(calibrationIssue("UNRESOLVED_TIME_OVERLAP", `Nevyřešený překryv segmentů: ${overlap.unresolvedOverlapMin.toFixed(2)} min.`));
      }
    }

    const hasBlockingError = issues.some((i) => i.severity === "error");
    const now = new Date().toISOString();
    const status = hasBlockingError ? "rejected" : "validated";
    await this.repository.save(record.withStatus(status, now));

    await this.eventPublisher.publish(
      buildCalculationEngineEvent({ type: "actual_time.validated", tenantId, entityId: record.id, actorId: input.actorId, correlationId: input.correlationId })
    );

    return { issues, status };
  }
}
