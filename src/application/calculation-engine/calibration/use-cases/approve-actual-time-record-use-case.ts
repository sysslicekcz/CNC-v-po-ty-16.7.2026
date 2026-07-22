import { TenantContext } from "@/domain/services/tenant-context";
import { ActualTimeRecordRepository } from "@/domain/calculation-engine/repositories/actual-time-record-repository";
import { CalculationError } from "@/domain/calculation-engine/errors/calculation-error";
import { calibrationIssue } from "@/domain/calculation-engine/calibration/calibration-issue-codes";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { DomainEventPublisher } from "@/domain/calculation-engine/events/domain-event-publisher";
import { buildCalculationEngineEvent } from "@/domain/calculation-engine/events/build-calculation-engine-event";

export interface ApproveActualTimeRecordInput {
  actualTimeRecordId: string;
  approvedBy: string;
  actorId?: string;
  correlationId?: string;
}

/** `ApproveActualTimeRecordUseCase` (AP-MCE-001 Fáze G §21/§22) - JEDINÉ
 *  místo, které smí posunout `ActualTimeRecord.status` na `"approved"` (§21
 *  "Žádné schválení nesmí být pouze v UI" - kontrola je tady, ne jen na
 *  tlačítku). Vyžaduje, aby záznam už byl `"validated"` (§26
 *  `ACTUAL_TIME_NOT_APPROVED` chrání navazující kroky - `CalibrationSample`
 *  §11 - před nevalidovanými daty). */
export class ApproveActualTimeRecordUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly repository: ActualTimeRecordRepository,
    private readonly featureAccessService: FeatureAccessService,
    private readonly eventPublisher: DomainEventPublisher
  ) {}

  async execute(input: ApproveActualTimeRecordInput): Promise<Record<string, unknown>> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationActualTimeApprove, "write");

    const record = await this.repository.getById(input.actualTimeRecordId, tenantId);
    if (!record) throw new CalculationError(`ActualTimeRecord "${input.actualTimeRecordId}" nebyl nalezen.`);
    if (record.status !== "validated") {
      throw new CalculationError(calibrationIssue("ACTUAL_TIME_NOT_APPROVED", `ActualTimeRecord "${input.actualTimeRecordId}" musí být nejdřív "validated" (aktuálně "${record.status}").`).message);
    }

    const now = new Date().toISOString();
    const approved = record.withApproval(input.approvedBy, now);
    await this.repository.save(approved);

    await this.eventPublisher.publish(
      buildCalculationEngineEvent({ type: "actual_time.approved", tenantId, entityId: approved.id, entityVersion: approved.recordVersion, actorId: input.actorId, correlationId: input.correlationId })
    );

    return approved.toPlainObject();
  }
}
