import { TenantContext } from "@/domain/services/tenant-context";
import { CalculationDraftRepository } from "@/domain/calculation-engine/repositories/calculation-draft-repository";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { DomainEventPublisher } from "@/domain/calculation-engine/events/domain-event-publisher";
import { buildCalculationEngineEvent } from "@/domain/calculation-engine/events/build-calculation-engine-event";

export interface DeleteCalculationDraftInput {
  id: string;
  actorId?: string;
  correlationId?: string;
}

/** `DeleteCalculationDraftUseCase` (AP-MCE-001 Fáze H §4/§27 "explicitní
 *  zahození konceptu") - koncept se maže NASTÁLO (na rozdíl od
 *  `CalculationResult`, `CalculationDraft` žádnou auditní historii nenese,
 *  viz komentář u entity). */
export class DeleteCalculationDraftUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly draftRepository: CalculationDraftRepository,
    private readonly featureAccessService: FeatureAccessService,
    private readonly eventPublisher: DomainEventPublisher
  ) {}

  async execute(input: DeleteCalculationDraftInput): Promise<void> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationCreate, "write");
    await this.draftRepository.delete(input.id, tenantId);
    await this.eventPublisher.publish(
      buildCalculationEngineEvent({ type: "calculation_draft.deleted", tenantId, entityId: input.id, actorId: input.actorId, correlationId: input.correlationId })
    );
  }
}
