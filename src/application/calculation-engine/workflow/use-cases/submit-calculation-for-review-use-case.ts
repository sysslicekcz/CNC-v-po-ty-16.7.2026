import { TenantContext } from "@/domain/services/tenant-context";
import { CalculationRepository } from "@/domain/calculation-engine/repositories/calculation-repository";
import { CalculationError } from "@/domain/calculation-engine/errors/calculation-error";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { DomainEventPublisher } from "@/domain/calculation-engine/events/domain-event-publisher";
import { buildCalculationEngineEvent } from "@/domain/calculation-engine/events/build-calculation-engine-event";
import { toOperationCalculationOutput } from "../../mappers/calculation-result-mapper";
import { OperationCalculationOutput } from "../../dto/operation-calculation-output";

export interface SubmitCalculationForReviewInput {
  calculationId: string;
  actorId?: string;
  correlationId?: string;
}

/** `SubmitCalculationForReviewUseCase` (AP-MCE-001 Fáze H §14/§36) -
 *  "Odeslat ke kontrole", první krok schvalovacího workflow. */
export class SubmitCalculationForReviewUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly calculationRepository: CalculationRepository,
    private readonly featureAccessService: FeatureAccessService,
    private readonly eventPublisher: DomainEventPublisher
  ) {}

  async execute(input: SubmitCalculationForReviewInput): Promise<OperationCalculationOutput> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationEdit, "write");

    const existing = await this.calculationRepository.findResultById(input.calculationId, tenantId);
    if (!existing) throw new CalculationError(`CalculationResult "${input.calculationId}" nebyl nalezen.`);

    const submitted = existing.submitForReview();
    await this.calculationRepository.saveResult(submitted);
    await this.eventPublisher.publish(
      buildCalculationEngineEvent({ type: "calculation_result.submitted_for_review", tenantId, entityId: submitted.id, actorId: input.actorId, correlationId: input.correlationId })
    );
    return toOperationCalculationOutput(submitted);
  }
}
