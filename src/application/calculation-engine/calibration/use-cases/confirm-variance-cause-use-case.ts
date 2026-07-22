import { TenantContext } from "@/domain/services/tenant-context";
import { VarianceCauseRepository } from "@/domain/calculation-engine/repositories/variance-cause-repository";
import { CalculationError } from "@/domain/calculation-engine/errors/calculation-error";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { DomainEventPublisher } from "@/domain/calculation-engine/events/domain-event-publisher";
import { buildCalculationEngineEvent } from "@/domain/calculation-engine/events/build-calculation-engine-event";

export interface ConfirmVarianceCauseInput {
  varianceCauseAssignmentId: string;
  confirmedBy: string;
  actorId?: string;
  correlationId?: string;
}

/** `ConfirmVarianceCauseUseCase` (AP-MCE-001 Fáze G §10/§22) - uživatel
 *  potvrdí navrženou příčinu (`confidence` skočí na 1, protože jde teď o
 *  lidské rozhodnutí, ne klasifikátorský odhad). */
export class ConfirmVarianceCauseUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly repository: VarianceCauseRepository,
    private readonly featureAccessService: FeatureAccessService,
    private readonly eventPublisher: DomainEventPublisher
  ) {}

  async execute(input: ConfirmVarianceCauseInput): Promise<Record<string, unknown>> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationCalibrationReview, "write");

    const assignment = await this.repository.getById(input.varianceCauseAssignmentId, tenantId);
    if (!assignment) throw new CalculationError(`VarianceCauseAssignment "${input.varianceCauseAssignmentId}" nebyl nalezen.`);

    const now = new Date().toISOString();
    const confirmed = assignment.confirm(input.confirmedBy, now);
    await this.repository.save(confirmed);

    await this.eventPublisher.publish(
      buildCalculationEngineEvent({ type: "variance_cause.confirmed", tenantId, entityId: confirmed.id, actorId: input.actorId, correlationId: input.correlationId })
    );

    return confirmed.toPlainObject();
  }
}
