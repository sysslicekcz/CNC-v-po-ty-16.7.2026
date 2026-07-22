import { TenantContext } from "@/domain/services/tenant-context";
import { CalibrationProposalRepository } from "@/domain/calculation-engine/repositories/calibration-proposal-repository";
import { CalculationError } from "@/domain/calculation-engine/errors/calculation-error";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { DomainEventPublisher } from "@/domain/calculation-engine/events/domain-event-publisher";
import { buildCalculationEngineEvent } from "@/domain/calculation-engine/events/build-calculation-engine-event";

export interface ReviewCalibrationProposalInput {
  proposalId: string;
  reviewedBy: string;
  actorId?: string;
  correlationId?: string;
}

/** `ReviewCalibrationProposalUseCase` (AP-MCE-001 Fáze G §21/§22) - krok
 *  "review" workflow (§21 bod 6) - PŘED schválením, po backtestu. */
export class ReviewCalibrationProposalUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly repository: CalibrationProposalRepository,
    private readonly featureAccessService: FeatureAccessService,
    private readonly eventPublisher: DomainEventPublisher
  ) {}

  async execute(input: ReviewCalibrationProposalInput): Promise<Record<string, unknown>> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationCalibrationReview, "write");

    const proposal = await this.repository.getById(input.proposalId, tenantId);
    if (!proposal) throw new CalculationError(`CalibrationProposal "${input.proposalId}" nebyl nalezen.`);

    const reviewed = proposal.review(input.reviewedBy, new Date().toISOString());
    await this.repository.save(reviewed);

    await this.eventPublisher.publish(
      buildCalculationEngineEvent({ type: "calibration_proposal.reviewed", tenantId, entityId: reviewed.id, actorId: input.actorId, correlationId: input.correlationId })
    );

    return reviewed.toPlainObject();
  }
}
