import { TenantContext } from "@/domain/services/tenant-context";
import { CalculationRepository } from "@/domain/calculation-engine/repositories/calculation-repository";
import { TechnologyOperationCalculationLinkRepository } from "@/domain/calculation-engine/repositories/technology-operation-calculation-link-repository";
import { TechnologyOperationCalculationLink } from "@/domain/calculation-engine/workflow/technology-operation-calculation-link";
import { CalculationError } from "@/domain/calculation-engine/errors/calculation-error";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { DomainEventPublisher } from "@/domain/calculation-engine/events/domain-event-publisher";
import { buildCalculationEngineEvent } from "@/domain/calculation-engine/events/build-calculation-engine-event";

export interface LinkCalculationToTechnologyOperationInput {
  technologyOperationId: string;
  calculationId: string;
  linkedBy: string;
  actorId?: string;
  correlationId?: string;
}

/**
 * `LinkCalculationToTechnologyOperationUseCase` (AP-MCE-001 Fáze H §17/§36) -
 * vytvoří vazbu na KONKRÉTNÍ immutable revizi (§17 "nesmí kopírovat celý
 * CalculationResult"), revize se počítá stejně jako Fáze G
 * `MatchActualTimeToCalculationUseCase` (pozice v řetězci `findResultsByRequestId`).
 * Pokud technologická operace už má aktivní vazbu, PŘEDCHOZÍ se supersedne
 * (§17 "zachovat historii vazeb" - nikdy se nemaže).
 */
export class LinkCalculationToTechnologyOperationUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly calculationRepository: CalculationRepository,
    private readonly linkRepository: TechnologyOperationCalculationLinkRepository,
    private readonly featureAccessService: FeatureAccessService,
    private readonly eventPublisher: DomainEventPublisher
  ) {}

  async execute(input: LinkCalculationToTechnologyOperationInput): Promise<Record<string, unknown>> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationEdit, "write");

    const result = await this.calculationRepository.findResultById(input.calculationId, tenantId);
    if (!result) throw new CalculationError(`CalculationResult "${input.calculationId}" nebyl nalezen.`);

    const chain = await this.calculationRepository.findResultsByRequestId(result.calculationRequestId, tenantId);
    const oldestFirst = [...chain].sort((a, b) => a.calculatedAt.localeCompare(b.calculatedAt));
    const calculationRevision = oldestFirst.findIndex((r) => r.id === result.id) + 1;

    const now = new Date().toISOString();
    const previousLinks = await this.linkRepository.listByTechnologyOperation(input.technologyOperationId, tenantId);
    const previousActive = previousLinks.find((l) => l.isActive);
    if (previousActive) {
      await this.linkRepository.save(previousActive.supersede());
      await this.eventPublisher.publish(
        buildCalculationEngineEvent({ type: "technology_operation_calculation_link.unlinked", tenantId, entityId: previousActive.id, actorId: input.actorId, correlationId: input.correlationId })
      );
    }

    const link = TechnologyOperationCalculationLink.create({
      id: crypto.randomUUID(),
      tenantId,
      technologyOperationId: input.technologyOperationId,
      calculationId: input.calculationId,
      calculationRevision,
      linkStatus: "active",
      linkedBy: input.linkedBy,
      linkedAt: now,
      externalReferences: [],
      recordVersion: 1,
    });
    await this.linkRepository.save(link);
    await this.eventPublisher.publish(
      buildCalculationEngineEvent({ type: "technology_operation_calculation_link.linked", tenantId, entityId: link.id, actorId: input.actorId, correlationId: input.correlationId })
    );

    return link.toPlainObject();
  }
}
