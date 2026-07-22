import { TenantContext } from "@/domain/services/tenant-context";
import { ActualTimeRecordRepository } from "@/domain/calculation-engine/repositories/actual-time-record-repository";
import { CalculationRepository } from "@/domain/calculation-engine/repositories/calculation-repository";
import { matchActualTimeToCalculation, CalculationCandidateForMatching, ActualTimeMatchResult } from "@/domain/calculation-engine/calibration/actual-time-calculation-matcher";
import { CalculationError } from "@/domain/calculation-engine/errors/calculation-error";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { DomainEventPublisher } from "@/domain/calculation-engine/events/domain-event-publisher";
import { buildCalculationEngineEvent } from "@/domain/calculation-engine/events/build-calculation-engine-event";

export interface MatchActualTimeToCalculationInput {
  actualTimeRecordId: string;
  /** Ruční přepis (§6 "5. ruční spárování") - pokud vyplněné, PŘESKOČÍ
   *  automatický matching a rovnou nastaví `"manually_matched"`. */
  manualCalculationId?: string;
  manualCalculationRevision?: number;
  actorId?: string;
  correlationId?: string;
}

/**
 * `MatchActualTimeToCalculationUseCase` (AP-MCE-001 Fáze G §6/§22) - jediné
 * místo, které SMÍ zavolat `CalculationRepository`/`ActualTimeRecordRepository`
 * a poskládat kandidáty pro čistý `matchActualTimeToCalculation()` (Domain).
 */
export class MatchActualTimeToCalculationUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly actualTimeRecordRepository: ActualTimeRecordRepository,
    private readonly calculationRepository: CalculationRepository,
    private readonly featureAccessService: FeatureAccessService,
    private readonly eventPublisher: DomainEventPublisher
  ) {}

  async execute(input: MatchActualTimeToCalculationInput): Promise<ActualTimeMatchResult> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationActualTimeEdit, "write");

    const record = await this.actualTimeRecordRepository.getById(input.actualTimeRecordId, tenantId);
    if (!record) throw new CalculationError(`ActualTimeRecord "${input.actualTimeRecordId}" nebyl nalezen.`);

    const now = new Date().toISOString();

    if (input.manualCalculationId) {
      const updated = record.withMatch(input.manualCalculationId, input.manualCalculationRevision ?? 1, now);
      await this.actualTimeRecordRepository.save(updated);
      await this.eventPublisher.publish(
        buildCalculationEngineEvent({ type: "actual_time.matched", tenantId, entityId: updated.id, actorId: input.actorId, correlationId: input.correlationId })
      );
      return { matchedCalculationId: input.manualCalculationId, matchedRevision: input.manualCalculationRevision ?? 1, matchMethod: "manual", confidence: 1, status: "manually_matched", warnings: [], alternativeCandidates: [] };
    }

    const results = await this.calculationRepository.listResultsByTenant(tenantId);
    const requestCache = new Map<string, Awaited<ReturnType<CalculationRepository["findRequestById"]>>>();
    const chainCache = new Map<string, string[]>();
    const candidates: CalculationCandidateForMatching[] = [];
    for (const result of results) {
      let request = requestCache.get(result.calculationRequestId);
      if (request === undefined) {
        request = await this.calculationRepository.findRequestById(result.calculationRequestId, tenantId);
        requestCache.set(result.calculationRequestId, request);
      }
      if (!request) continue;

      // `CalculationResult` nemá vlastní číselnou revizi (jen `supersedesResultId`
      // odkaz na PŘEDCHOZÍ výsledek) - revize se odvodí jako pozice v řetězu
      // `findResultsByRequestId` (nejstarší = 1), stejný chain pro celý request
      // se počítá jen jednou (`chainCache`).
      let chainOldestFirst = chainCache.get(result.calculationRequestId);
      if (!chainOldestFirst) {
        const chain = await this.calculationRepository.findResultsByRequestId(result.calculationRequestId, tenantId);
        chainOldestFirst = [...chain].sort((a, b) => a.calculatedAt.localeCompare(b.calculatedAt)).map((r) => r.id);
        chainCache.set(result.calculationRequestId, chainOldestFirst);
      }
      const revision = chainOldestFirst.indexOf(result.id) + 1 || 1;

      const snapshot = request.inputSnapshot as Record<string, unknown>;
      candidates.push({
        calculationId: result.id,
        calculationRevision: revision,
        operationCategory: request.operationCategory,
        machineId: snapshot.machineId as string | undefined,
        externalReferences: [],
        productionOrderId: snapshot.productionOrderId as string | undefined,
        operationSequence: snapshot.operationSequence as number | undefined,
        calculatedAt: result.calculatedAt,
      });
    }

    const matchResult = matchActualTimeToCalculation(record, candidates);

    if (matchResult.status === "matched" && matchResult.matchedCalculationId && matchResult.matchedRevision !== undefined) {
      const updated = record.withMatch(matchResult.matchedCalculationId, matchResult.matchedRevision, now);
      await this.actualTimeRecordRepository.save(updated);
      await this.eventPublisher.publish(
        buildCalculationEngineEvent({ type: "actual_time.matched", tenantId, entityId: updated.id, actorId: input.actorId, correlationId: input.correlationId })
      );
    } else {
      await this.eventPublisher.publish(
        buildCalculationEngineEvent({ type: "actual_time.match_failed", tenantId, entityId: record.id, actorId: input.actorId, correlationId: input.correlationId })
      );
    }

    return matchResult;
  }
}
