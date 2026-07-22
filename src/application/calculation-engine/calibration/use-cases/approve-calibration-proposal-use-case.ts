import { TenantContext } from "@/domain/services/tenant-context";
import { CalibrationProposalRepository } from "@/domain/calculation-engine/repositories/calibration-proposal-repository";
import { CalculationError } from "@/domain/calculation-engine/errors/calculation-error";
import { calibrationIssue } from "@/domain/calculation-engine/calibration/calibration-issue-codes";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { DomainEventPublisher } from "@/domain/calculation-engine/events/domain-event-publisher";
import { buildCalculationEngineEvent } from "@/domain/calculation-engine/events/build-calculation-engine-event";

export interface ApproveCalibrationProposalInput {
  proposalId: string;
  approvedBy: string;
  actorId?: string;
  correlationId?: string;
}

/**
 * `ApproveCalibrationProposalUseCase` (AP-MCE-001 Fáze G §18/§21/§22) -
 * VYŽADUJE, aby návrh už měl `validationResult.passed === true` (backtest
 * proběhl a NEZHORŠIL validační množinu, §17/§18 "Při nesplnění vrať
 * blocking validation error") - schválení bez úspěšného backtestu se
 * ZAMÍTÁ, ne jen varuje.
 */
export class ApproveCalibrationProposalUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly repository: CalibrationProposalRepository,
    private readonly featureAccessService: FeatureAccessService,
    private readonly eventPublisher: DomainEventPublisher
  ) {}

  async execute(input: ApproveCalibrationProposalInput): Promise<Record<string, unknown>> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationCalibrationApprove, "write");

    const proposal = await this.repository.getById(input.proposalId, tenantId);
    if (!proposal) throw new CalculationError(`CalibrationProposal "${input.proposalId}" nebyl nalezen.`);
    if (!proposal.validationResult || !proposal.validationResult.passed) {
      throw new CalculationError(calibrationIssue("CALIBRATION_BACKTEST_FAILED", `CalibrationProposal "${input.proposalId}" nemá úspěšný backtest - nesmí být schválen.`).message);
    }

    const approved = proposal.approve(input.approvedBy, new Date().toISOString());
    await this.repository.save(approved);

    await this.eventPublisher.publish(
      buildCalculationEngineEvent({ type: "calibration_proposal.approved", tenantId, entityId: approved.id, actorId: input.actorId, correlationId: input.correlationId })
    );

    return approved.toPlainObject();
  }
}
