import { TenantContext } from "@/domain/services/tenant-context";
import { CalculationRepository } from "@/domain/calculation-engine/repositories/calculation-repository";
import { CalculationError } from "@/domain/calculation-engine/errors/calculation-error";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { DomainEventPublisher } from "@/domain/calculation-engine/events/domain-event-publisher";
import { buildCalculationEngineEvent } from "@/domain/calculation-engine/events/build-calculation-engine-event";
import { toOperationCalculationOutput } from "../../mappers/calculation-result-mapper";
import { OperationCalculationOutput } from "../../dto/operation-calculation-output";

export interface ApproveCalculationInput {
  calculationId: string;
  reviewedBy: string;
  actorId?: string;
  correlationId?: string;
}

/** `ApproveCalculationUseCase` (AP-MCE-001 Fáze H §14/§36) - vyžaduje
 *  `calculation.approve` (Fáze B/C katalogový kód, dosud nikde nepoužitý -
 *  Fáze H je první use case, který ho skutečně vynucuje). */
export class ApproveCalculationUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly calculationRepository: CalculationRepository,
    private readonly featureAccessService: FeatureAccessService,
    private readonly eventPublisher: DomainEventPublisher
  ) {}

  async execute(input: ApproveCalculationInput): Promise<OperationCalculationOutput> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationApprove, "write");

    const existing = await this.calculationRepository.findResultById(input.calculationId, tenantId);
    if (!existing) throw new CalculationError(`CalculationResult "${input.calculationId}" nebyl nalezen.`);

    const approved = existing.approve(input.reviewedBy, new Date().toISOString());
    await this.calculationRepository.saveResult(approved);
    await this.eventPublisher.publish(
      buildCalculationEngineEvent({ type: "calculation_result.approved", tenantId, entityId: approved.id, actorId: input.actorId, correlationId: input.correlationId })
    );
    return toOperationCalculationOutput(approved);
  }
}
