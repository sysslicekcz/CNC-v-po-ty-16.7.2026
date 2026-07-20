import type { OperationCategory } from "@/domain/calculation-engine/enums/operation-category";
import { FeedRateUnit } from "@/domain/calculation-engine/value-objects/feed-rate";
import { CuttingSpeed } from "@/domain/calculation-engine/value-objects/cutting-speed";
import { FeedRate } from "@/domain/calculation-engine/value-objects/feed-rate";
import { CalculationContext } from "@/domain/calculation-engine/contracts/calculation-context";
import { RuleRepository } from "@/domain/calculation-engine/repositories/rule-repository";
import { CalculationError } from "@/domain/calculation-engine/errors/calculation-error";
import { DomainEventPublisher } from "@/domain/calculation-engine/events/domain-event-publisher";
import { buildCalculationEngineEvent } from "@/domain/calculation-engine/events/build-calculation-engine-event";
import { MaterialProfileResolver } from "./material-profile-resolver";
import { MachineProfileResolver } from "./machine-profile-resolver";
import { ToolProfileResolver } from "./tool-profile-resolver";
import { CuttingConditionResolverService } from "./cutting-condition-resolver-service";

export interface ResolveCalculationContextInput {
  tenantId: string;
  materialProfileId: string;
  machineProfileId?: string;
  toolProfileId?: string;
  operationCategory: OperationCategory;
  operationSubtype?: string;
  feedUnit: FeedRateUnit;
  explicitValues?: { cuttingSpeed?: CuttingSpeed; feed?: FeedRate };
  ruleVersionId?: string;
  actorId?: string;
  correlationId?: string;
}

/**
 * `CalculationContextResolver` (AP-MCE-001 Fáze B §6) - JEDINÉ místo, které
 * sestaví celý `CalculationContext` (materiál/stroj/nástroj snapshoty,
 * vyřešené řezné podmínky, verze pravidel) PŘED voláním `CalculationEngine.
 * calculate(...)`. `CalculationStrategy` sama repozitáře nikdy nevolá (§06) -
 * tenhle resolver je přesně ta hranice, o kterou se strategie opírá.
 *
 * `machineProfileId`/`toolProfileId` jsou nepovinné (operace bez konkrétního
 * stroje/nástroje, např. plánovací odhad nebo NDT kontrola) - jejich snapshoty
 * pak v kontextu chybí, ne že by resolver vyhodil chybu. Řezné podmínky samy
 * řeší `CuttingConditionResolverService` (sdílená s `ResolveCuttingCondition
 * sUseCase`, aby se stejné načítání kandidátů/systémového defaultu nepsalo na
 * dvou místech).
 */
export class CalculationContextResolver {
  constructor(
    private readonly materialProfileResolver: MaterialProfileResolver,
    private readonly machineProfileResolver: MachineProfileResolver,
    private readonly toolProfileResolver: ToolProfileResolver,
    private readonly cuttingConditionResolverService: CuttingConditionResolverService,
    private readonly ruleRepository: RuleRepository,
    private readonly eventPublisher: DomainEventPublisher
  ) {}

  async resolve(input: ResolveCalculationContextInput): Promise<CalculationContext> {
    const now = new Date().toISOString();

    const ruleVersion = input.ruleVersionId
      ? await this.ruleRepository.findById(input.ruleVersionId, input.tenantId)
      : await this.ruleRepository.findActiveVersion(input.tenantId);
    if (!ruleVersion) {
      throw new CalculationError(
        input.ruleVersionId
          ? `Verze pravidel "${input.ruleVersionId}" nebyla nalezena.`
          : `Pro organizaci "${input.tenantId}" není nastavená žádná aktivní verze výpočtových pravidel.`
      );
    }

    const material = await this.materialProfileResolver.resolve(input.materialProfileId, input.tenantId);
    const materialProfileSnapshot = await this.materialProfileResolver.resolveSnapshot(input.materialProfileId, input.tenantId, now);

    const machine = input.machineProfileId ? await this.machineProfileResolver.resolve(input.machineProfileId, input.tenantId) : undefined;
    const machineProfileSnapshot = input.machineProfileId
      ? await this.machineProfileResolver.resolveSnapshot(input.machineProfileId, input.tenantId, now)
      : undefined;

    const toolProfileSnapshot = input.toolProfileId
      ? await this.toolProfileResolver.resolveSnapshot(input.toolProfileId, input.tenantId, now)
      : undefined;

    const { snapshot: cuttingConditionSnapshot } = await this.cuttingConditionResolverService.resolve(
      {
        tenantId: input.tenantId,
        materialProfileId: input.materialProfileId,
        machineProfileId: input.machineProfileId,
        toolProfileId: input.toolProfileId,
        operationCategory: input.operationCategory,
        operationSubtype: input.operationSubtype,
        feedUnit: input.feedUnit,
        explicitValues: input.explicitValues,
      },
      now
    );

    await this.eventPublisher.publish(
      buildCalculationEngineEvent({
        type: "calculation_context.resolved",
        tenantId: input.tenantId,
        siteId: material.resolved.siteId,
        entityId: input.materialProfileId,
        actorId: input.actorId,
        correlationId: input.correlationId,
        occurredAt: now,
      })
    );

    return {
      ruleVersion,
      materialProfileSnapshot,
      machineProfileSnapshot,
      toolProfileSnapshot,
      cuttingConditionSnapshot,
      calibrationProfileId: machine?.resolved.calibrationProfileId,
    };
  }
}
