import { TenantContext } from "@/domain/services/tenant-context";
import { TechnologyOperationCalculationLinkRepository } from "@/domain/calculation-engine/repositories/technology-operation-calculation-link-repository";
import { CalculationError } from "@/domain/calculation-engine/errors/calculation-error";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { DomainEventPublisher } from "@/domain/calculation-engine/events/domain-event-publisher";
import { buildCalculationEngineEvent } from "@/domain/calculation-engine/events/build-calculation-engine-event";

export interface UnlinkCalculationFromTechnologyOperationInput {
  linkId: string;
  actorId?: string;
  correlationId?: string;
}

/** `UnlinkCalculationFromTechnologyOperationUseCase` (AP-MCE-001 Fáze H
 *  §17/§36) - "odpojit výpočet", historie vazby zůstává (§17). */
export class UnlinkCalculationFromTechnologyOperationUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly linkRepository: TechnologyOperationCalculationLinkRepository,
    private readonly featureAccessService: FeatureAccessService,
    private readonly eventPublisher: DomainEventPublisher
  ) {}

  async execute(input: UnlinkCalculationFromTechnologyOperationInput): Promise<Record<string, unknown>> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationEdit, "write");

    const existing = await this.linkRepository.getById(input.linkId, tenantId);
    if (!existing) throw new CalculationError(`TechnologyOperationCalculationLink "${input.linkId}" nebyl nalezen.`);

    const detached = existing.detach(new Date().toISOString());
    await this.linkRepository.save(detached);
    await this.eventPublisher.publish(
      buildCalculationEngineEvent({ type: "technology_operation_calculation_link.unlinked", tenantId, entityId: detached.id, actorId: input.actorId, correlationId: input.correlationId })
    );
    return detached.toPlainObject();
  }
}
