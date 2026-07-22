import { TenantContext } from "@/domain/services/tenant-context";
import { ActualTimeRecordRepository } from "@/domain/calculation-engine/repositories/actual-time-record-repository";
import { ActualTimeRecord, ActualTimeRecordProps } from "@/domain/calculation-engine/calibration/actual-time-record";
import { CalculationError } from "@/domain/calculation-engine/errors/calculation-error";
import { ProfileVersionConflictError } from "@/domain/calculation-engine/errors/profile-version-conflict-error";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { DomainEventPublisher } from "@/domain/calculation-engine/events/domain-event-publisher";
import { buildCalculationEngineEvent } from "@/domain/calculation-engine/events/build-calculation-engine-event";

export interface UpdateActualTimeRecordInput {
  actualTimeRecordId: string;
  expectedVersion: number;
  changes: Partial<
    Pick<
      ActualTimeRecordProps,
      | "quantityPlanned"
      | "quantityCompleted"
      | "quantityScrapped"
      | "setupTimeMin"
      | "machineTimeMin"
      | "operatorTimeMin"
      | "handlingTimeMin"
      | "inspectionTimeMin"
      | "waitingTimeMin"
      | "downtimeMin"
      | "reworkTimeMin"
      | "toolChangeTimeMin"
      | "fixtureChangeTimeMin"
      | "interruptionTimeMin"
      | "goodPieceTimeMin"
      | "notes"
    >
  >;
  actorId?: string;
  correlationId?: string;
}

/** `UpdateActualTimeRecordUseCase` (AP-MCE-001 Fáze G §22) - úprava JEŠTĚ
 *  neschváleného záznamu (§2 status `"draft"`/`"validated"`/`"rejected"`) -
 *  jednou schválený záznam (`"approved"`) se needituje přímo, oprava vytvoří
 *  nový záznam se `sourceType: "corrected"` (mimo rozsah tohohle use casu). */
export class UpdateActualTimeRecordUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly repository: ActualTimeRecordRepository,
    private readonly featureAccessService: FeatureAccessService,
    private readonly eventPublisher: DomainEventPublisher
  ) {}

  async execute(input: UpdateActualTimeRecordInput): Promise<Record<string, unknown>> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationActualTimeEdit, "write");

    const existing = await this.repository.getById(input.actualTimeRecordId, tenantId);
    if (!existing) throw new CalculationError(`ActualTimeRecord "${input.actualTimeRecordId}" nebyl nalezen.`);
    if (existing.recordVersion !== input.expectedVersion) {
      throw new ProfileVersionConflictError(input.actualTimeRecordId, input.expectedVersion, existing.recordVersion);
    }
    if (existing.status === "approved") {
      throw new CalculationError(`ActualTimeRecord "${input.actualTimeRecordId}" je už schválený - úprava vytvoří novou verzi ('sourceType: corrected'), ne editaci na místě.`);
    }

    const now = new Date().toISOString();
    const merged = { ...(existing.toPlainObject() as unknown as ActualTimeRecordProps), ...input.changes, updatedAt: now, recordVersion: existing.recordVersion + 1 };
    const updated = ActualTimeRecord.create(merged);

    await this.repository.save(updated);
    await this.eventPublisher.publish(
      buildCalculationEngineEvent({ type: "actual_time.updated", tenantId, entityId: updated.id, entityVersion: updated.recordVersion, actorId: input.actorId, correlationId: input.correlationId })
    );

    return updated.toPlainObject();
  }
}
