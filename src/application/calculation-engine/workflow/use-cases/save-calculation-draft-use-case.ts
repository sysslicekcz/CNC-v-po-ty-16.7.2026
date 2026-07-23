import { TenantContext } from "@/domain/services/tenant-context";
import { CalculationDraftRepository } from "@/domain/calculation-engine/repositories/calculation-draft-repository";
import { CalculationDraft, CalculationDraftSourceType } from "@/domain/calculation-engine/workflow/calculation-draft";
import type { OperationCategory } from "@/domain/calculation-engine/enums/operation-category";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { DomainEventPublisher } from "@/domain/calculation-engine/events/domain-event-publisher";
import { buildCalculationEngineEvent } from "@/domain/calculation-engine/events/build-calculation-engine-event";

export interface SaveCalculationDraftInput {
  /** `undefined` => nový koncept vznikne. */
  id?: string;
  sourceType: CalculationDraftSourceType;
  sourceReferenceId?: string;
  operationCategory?: OperationCategory;
  currentStep: number;
  formState: Record<string, unknown>;
  createdBy: string;
  actorId?: string;
  correlationId?: string;
}

/**
 * `SaveCalculationDraftUseCase` (AP-MCE-001 Fáze H §4/§27/§36) - autosave
 * `NewCalculationWizard` konceptu. NIKDY nevytváří `CalculationRequest`/
 * `CalculationResult` (§27 "Autosave nesmí vytvářet CalculationResult
 * revize") - jen ukládá syrový stav formuláře.
 */
export class SaveCalculationDraftUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly draftRepository: CalculationDraftRepository,
    private readonly featureAccessService: FeatureAccessService,
    private readonly eventPublisher: DomainEventPublisher
  ) {}

  async execute(input: SaveCalculationDraftInput): Promise<Record<string, unknown>> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationCreate, "write");

    const now = new Date().toISOString();
    const existing = input.id ? await this.draftRepository.getById(input.id, tenantId) : null;

    const draft = existing
      ? existing.withProgress(input.currentStep, input.formState, input.operationCategory, now)
      : CalculationDraft.create({
          id: crypto.randomUUID(),
          tenantId,
          sourceType: input.sourceType,
          sourceReferenceId: input.sourceReferenceId,
          operationCategory: input.operationCategory,
          currentStep: input.currentStep,
          formState: input.formState,
          createdBy: input.createdBy,
          createdAt: now,
          updatedAt: now,
        });

    await this.draftRepository.save(draft);
    await this.eventPublisher.publish(
      buildCalculationEngineEvent({ type: "calculation_draft.saved", tenantId, entityId: draft.id, actorId: input.actorId, correlationId: input.correlationId })
    );

    return draft.toPlainObject();
  }
}
