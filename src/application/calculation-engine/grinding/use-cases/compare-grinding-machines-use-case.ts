import { TenantContext } from "@/domain/services/tenant-context";
import { CalculationEngine } from "@/domain/calculation-engine/services/calculation-engine";
import { CalculationIssue } from "@/domain/calculation-engine/entities/types";
import { GrindingCalculationInput } from "@/domain/calculation-engine/grinding/grinding-calculation-input";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { DomainEventPublisher } from "@/domain/calculation-engine/events/domain-event-publisher";
import { buildCalculationEngineEvent } from "@/domain/calculation-engine/events/build-calculation-engine-event";
import { GrindingCalculationContextBuilderPort } from "../grinding-calculation-context-builder";

export interface CompareGrindingMachinesInput {
  input: GrindingCalculationInput;
  machineProfileIds: readonly string[];
  actorId?: string;
  correlationId?: string;
}

export interface GrindingMachineComparisonEntry {
  machineProfileId: string;
  blocked: boolean;
  totalOperationTimeMinutes?: number;
  confidenceScore?: number;
  measurementTimeMinutes?: number;
  dressingTimeMinutes?: number;
  /** Rozdíl PROTI NEJRYCHLEJŠÍMU nezablokovanému stroji ve srovnání. */
  timeDeltaMinutes?: number;
  confidenceDelta?: number;
  measurementTimeDeltaMinutes?: number;
  dressingTimeDeltaMinutes?: number;
  /** §17 "zobrazit chybějící capabilities" - kódy chybějících schopností z
   *  `issues` (`MACHINE_NOT_*_CAPABLE`/`*_UNAVAILABLE`). */
  missingCapabilityCodes: readonly string[];
  issues: readonly CalculationIssue[];
}

const CAPABILITY_ISSUE_CODES = new Set([
  "MACHINE_NOT_CYLINDRICAL_GRINDING_CAPABLE",
  "MACHINE_NOT_SURFACE_GRINDING_CAPABLE",
  "MACHINE_NOT_INTERNAL_GRINDING_CAPABLE",
  "MACHINE_NOT_CENTERLESS_CAPABLE",
  "PRECISION_CAPABILITY_INSUFFICIENT",
]);

/**
 * `CompareGrindingMachinesUseCase` (AP-MCE-001 Fáze E §17) - STEJNÝ
 * technologický vstup, pro každý kandidát se nahradí JEN `MachineProfile` -
 * stejná konvence jako Fáze C/D. Navíc oproti nim zobrazuje rozdíl v čase
 * měření a orovnání (§17 "zobrazit rozdíl v měření a dressing čase").
 * Analytická operace - vyžaduje jen `calculation.read`.
 */
export class CompareGrindingMachinesUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly contextBuilder: GrindingCalculationContextBuilderPort,
    private readonly calculationEngine: CalculationEngine,
    private readonly featureAccessService: FeatureAccessService,
    private readonly eventPublisher: DomainEventPublisher
  ) {}

  async execute(input: CompareGrindingMachinesInput): Promise<GrindingMachineComparisonEntry[]> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationRead, "read");

    const entries: GrindingMachineComparisonEntry[] = [];
    for (const machineProfileId of input.machineProfileIds) {
      const context = await this.contextBuilder.build(input.input, tenantId, { machineProfileIdOverride: machineProfileId });
      const outcome = this.calculationEngine.calculate(input.input, context);
      const issues = outcome.breakdown?.grindingDetail
        ? [...outcome.issues, ...outcome.breakdown.grindingDetail.warnings, ...outcome.breakdown.grindingDetail.recommendations]
        : outcome.issues;
      entries.push({
        machineProfileId,
        blocked: outcome.blocked,
        totalOperationTimeMinutes: outcome.breakdown?.totalOperationTime.minutes,
        confidenceScore: outcome.breakdown?.grindingDetail?.confidenceScore,
        measurementTimeMinutes: outcome.breakdown?.grindingDetail?.measurementTimeMin,
        dressingTimeMinutes: outcome.breakdown?.grindingDetail?.dressingTimeMin,
        missingCapabilityCodes: issues.filter((i) => CAPABILITY_ISSUE_CODES.has(i.code)).map((i) => i.code),
        issues,
      });
    }

    const sorted = entries.sort((a, b) => (a.totalOperationTimeMinutes ?? Infinity) - (b.totalOperationTimeMinutes ?? Infinity));
    const bestTime = sorted.find((e) => e.totalOperationTimeMinutes !== undefined)?.totalOperationTimeMinutes;
    const bestConfidence = sorted.find((e) => e.confidenceScore !== undefined)?.confidenceScore;
    const bestMeasurement = sorted.find((e) => e.measurementTimeMinutes !== undefined)?.measurementTimeMinutes;
    const bestDressing = sorted.find((e) => e.dressingTimeMinutes !== undefined)?.dressingTimeMinutes;
    const withDeltas = sorted.map((entry) => ({
      ...entry,
      timeDeltaMinutes: entry.totalOperationTimeMinutes !== undefined && bestTime !== undefined ? entry.totalOperationTimeMinutes - bestTime : undefined,
      confidenceDelta: entry.confidenceScore !== undefined && bestConfidence !== undefined ? entry.confidenceScore - bestConfidence : undefined,
      measurementTimeDeltaMinutes: entry.measurementTimeMinutes !== undefined && bestMeasurement !== undefined ? entry.measurementTimeMinutes - bestMeasurement : undefined,
      dressingTimeDeltaMinutes: entry.dressingTimeMinutes !== undefined && bestDressing !== undefined ? entry.dressingTimeMinutes - bestDressing : undefined,
    }));

    await this.eventPublisher.publish(
      buildCalculationEngineEvent({
        type: "grinding_machine_comparison.completed",
        tenantId,
        entityId: input.input.materialId,
        actorId: input.actorId,
        correlationId: input.correlationId,
      })
    );

    return withDeltas;
  }
}
