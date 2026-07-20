import { TenantContext } from "@/domain/services/tenant-context";
import { CalculationEngine } from "@/domain/calculation-engine/services/calculation-engine";
import { CalculationIssue } from "@/domain/calculation-engine/entities/types";
import { TurningCalculationInput } from "@/domain/calculation-engine/turning/turning-calculation-input";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { DomainEventPublisher } from "@/domain/calculation-engine/events/domain-event-publisher";
import { buildCalculationEngineEvent } from "@/domain/calculation-engine/events/build-calculation-engine-event";
import { TurningCalculationContextBuilder } from "../turning-calculation-context-builder";

export interface CompareTurningMachinesInput {
  input: TurningCalculationInput;
  machineProfileIds: readonly string[];
  actorId?: string;
  correlationId?: string;
}

export interface TurningMachineComparisonEntry {
  machineProfileId: string;
  blocked: boolean;
  totalOperationTimeMinutes?: number;
  confidenceScore?: number;
  /** Rozdíl PROTI NEJRYCHLEJŠÍMU nezablokovanému stroji ve srovnání (kladné
   *  číslo = pomalejší) - `undefined`, pokud je stroj zablokovaný. */
  timeDeltaMinutes?: number;
  confidenceDelta?: number;
  issues: readonly CalculationIssue[];
}

/**
 * `CompareTurningMachinesUseCase` (AP-MCE-001 Fáze C §14) - STEJNÝ
 * technologický vstup (`input`), pro každý kandidát se nahradí JEN
 * `MachineProfile` (`TurningCalculationContextBuilder.machineProfileIdOverride`)
 * - žádná jiná část vstupu/kontextu se neliší. Výsledky seřazené podle
 * celkového času (nejrychlejší první, zablokované stroje na konci).
 * Analytická operace - vyžaduje jen `calculation.read` (§17, stejná
 * konvence jako Fáze B `CompareMachineProfilesUseCase`).
 */
export class CompareTurningMachinesUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly contextBuilder: TurningCalculationContextBuilder,
    private readonly calculationEngine: CalculationEngine,
    private readonly featureAccessService: FeatureAccessService,
    private readonly eventPublisher: DomainEventPublisher
  ) {}

  async execute(input: CompareTurningMachinesInput): Promise<TurningMachineComparisonEntry[]> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationRead, "read");

    const entries: TurningMachineComparisonEntry[] = [];
    for (const machineProfileId of input.machineProfileIds) {
      const context = await this.contextBuilder.build(input.input, tenantId, { machineProfileIdOverride: machineProfileId });
      const outcome = this.calculationEngine.calculate(input.input, context);
      const issues = outcome.breakdown?.turningDetail
        ? [...outcome.issues, ...outcome.breakdown.turningDetail.warnings, ...outcome.breakdown.turningDetail.recommendations]
        : outcome.issues;
      entries.push({
        machineProfileId,
        blocked: outcome.blocked,
        totalOperationTimeMinutes: outcome.breakdown?.totalOperationTime.minutes,
        confidenceScore: outcome.breakdown?.turningDetail?.confidenceScore,
        issues,
      });
    }

    const sorted = entries.sort((a, b) => (a.totalOperationTimeMinutes ?? Infinity) - (b.totalOperationTimeMinutes ?? Infinity));
    const bestTime = sorted.find((e) => e.totalOperationTimeMinutes !== undefined)?.totalOperationTimeMinutes;
    const bestConfidence = sorted.find((e) => e.confidenceScore !== undefined)?.confidenceScore;
    const withDeltas = sorted.map((entry) => ({
      ...entry,
      timeDeltaMinutes: entry.totalOperationTimeMinutes !== undefined && bestTime !== undefined ? entry.totalOperationTimeMinutes - bestTime : undefined,
      confidenceDelta: entry.confidenceScore !== undefined && bestConfidence !== undefined ? entry.confidenceScore - bestConfidence : undefined,
    }));

    await this.eventPublisher.publish(
      buildCalculationEngineEvent({
        type: "turning_machine_comparison.completed",
        tenantId,
        entityId: input.input.materialId,
        actorId: input.actorId,
        correlationId: input.correlationId,
      })
    );

    return withDeltas;
  }
}
