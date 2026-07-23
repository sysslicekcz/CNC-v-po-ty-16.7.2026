import { TenantContext } from "@/domain/services/tenant-context";
import { CalculationRepository } from "@/domain/calculation-engine/repositories/calculation-repository";
import { QuoteCalculationLinkRepository } from "@/domain/calculation-engine/repositories/quote-calculation-link-repository";
import { QuoteCalculationLink } from "@/domain/calculation-engine/workflow/quote-calculation-link";
import { CalculationError } from "@/domain/calculation-engine/errors/calculation-error";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { DomainEventPublisher } from "@/domain/calculation-engine/events/domain-event-publisher";
import { buildCalculationEngineEvent } from "@/domain/calculation-engine/events/build-calculation-engine-event";

export interface LinkCalculationToQuoteItemInput {
  quoteItemId: string;
  calculationId: string;
  quantity: number;
  machineVariantLabel?: string;
  toolVariantLabel?: string;
  isSelectedVariant: boolean;
  linkedBy: string;
  actorId?: string;
  correlationId?: string;
}

/** `LinkCalculationToQuoteItemUseCase` (AP-MCE-001 Fáze H §19/§36) - časová
 *  (NE finanční, §19) integrace na položku nabídky - viz `QuoteCalculationLink`
 *  komentář o neexistenci Quote modulu v projektu. */
export class LinkCalculationToQuoteItemUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly calculationRepository: CalculationRepository,
    private readonly linkRepository: QuoteCalculationLinkRepository,
    private readonly featureAccessService: FeatureAccessService,
    private readonly eventPublisher: DomainEventPublisher
  ) {}

  async execute(input: LinkCalculationToQuoteItemInput): Promise<Record<string, unknown>> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationEdit, "write");

    const result = await this.calculationRepository.findResultById(input.calculationId, tenantId);
    if (!result) throw new CalculationError(`CalculationResult "${input.calculationId}" nebyl nalezen.`);

    const chain = await this.calculationRepository.findResultsByRequestId(result.calculationRequestId, tenantId);
    const oldestFirst = [...chain].sort((a, b) => a.calculatedAt.localeCompare(b.calculatedAt));
    const calculationRevision = oldestFirst.findIndex((r) => r.id === result.id) + 1;

    const link = QuoteCalculationLink.create({
      id: crypto.randomUUID(),
      tenantId,
      quoteItemId: input.quoteItemId,
      calculationId: input.calculationId,
      calculationRevision,
      quantity: input.quantity,
      machineVariantLabel: input.machineVariantLabel,
      toolVariantLabel: input.toolVariantLabel,
      isSelectedVariant: input.isSelectedVariant,
      confidenceScore: result.confidenceScore,
      linkedBy: input.linkedBy,
      linkedAt: new Date().toISOString(),
      recordVersion: 1,
    });
    await this.linkRepository.save(link);
    await this.eventPublisher.publish(
      buildCalculationEngineEvent({ type: "quote_calculation_link.linked", tenantId, entityId: link.id, actorId: input.actorId, correlationId: input.correlationId })
    );
    return link.toPlainObject();
  }
}
