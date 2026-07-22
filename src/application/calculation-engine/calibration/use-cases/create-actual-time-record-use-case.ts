import { TenantContext } from "@/domain/services/tenant-context";
import { ActualTimeRecordRepository } from "@/domain/calculation-engine/repositories/actual-time-record-repository";
import { ActualTimeRecord, ActualTimeRecordProps } from "@/domain/calculation-engine/calibration/actual-time-record";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { DomainEventPublisher } from "@/domain/calculation-engine/events/domain-event-publisher";
import { buildCalculationEngineEvent } from "@/domain/calculation-engine/events/build-calculation-engine-event";

export type CreateActualTimeRecordInput = Omit<ActualTimeRecordProps, "id" | "tenantId" | "status" | "recordVersion" | "createdAt" | "updatedAt" | "archivedAt"> & {
  actorId?: string;
  correlationId?: string;
};

/**
 * `CreateActualTimeRecordUseCase` (AP-MCE-001 Fáze G §22) - ruční zadání
 * skutečného času (§2 "ruční zadání skutečných časů") - status vždy začíná
 * `"draft"` (§2 status enum), schválení řeší samostatný
 * `ApproveActualTimeRecordUseCase` (§21 workflow - "žádné schválení nesmí
 * být pouze v UI").
 */
export class CreateActualTimeRecordUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly repository: ActualTimeRecordRepository,
    private readonly featureAccessService: FeatureAccessService,
    private readonly eventPublisher: DomainEventPublisher
  ) {}

  async execute(input: CreateActualTimeRecordInput): Promise<Record<string, unknown>> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationActualTimeCreate, "write");

    const now = new Date().toISOString();
    const record = ActualTimeRecord.create({
      ...input,
      id: crypto.randomUUID(),
      tenantId,
      status: "draft",
      recordVersion: 1,
      createdAt: now,
      updatedAt: now,
    });

    await this.repository.save(record);
    await this.eventPublisher.publish(
      buildCalculationEngineEvent({ type: "actual_time.created", tenantId, entityId: record.id, entityVersion: record.recordVersion, actorId: input.actorId, correlationId: input.correlationId })
    );

    return record.toPlainObject();
  }
}
