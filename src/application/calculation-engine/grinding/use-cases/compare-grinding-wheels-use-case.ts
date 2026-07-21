import { TenantContext } from "@/domain/services/tenant-context";
import { CalculationEngine } from "@/domain/calculation-engine/services/calculation-engine";
import { CalculationIssue } from "@/domain/calculation-engine/entities/types";
import { GrindingCalculationInput } from "@/domain/calculation-engine/grinding/grinding-calculation-input";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { DomainEventPublisher } from "@/domain/calculation-engine/events/domain-event-publisher";
import { buildCalculationEngineEvent } from "@/domain/calculation-engine/events/build-calculation-engine-event";
import { GrindingCalculationContextBuilderPort } from "../grinding-calculation-context-builder";

export interface CompareGrindingWheelsInput {
  input: GrindingCalculationInput;
  /** Který `GrindingFeature` se porovnává - různé featury mohou používat
   *  různé kotouče (§3). */
  featureId: string;
  wheelProfileIds: readonly string[];
  actorId?: string;
  correlationId?: string;
}

export interface GrindingWheelComparisonEntry {
  wheelProfileId: string;
  blocked: boolean;
  totalOperationTimeMinutes?: number;
  confidenceScore?: number;
  dressingTimeMinutes?: number;
  timeDeltaMinutes?: number;
  confidenceDelta?: number;
  dressingTimeDeltaMinutes?: number;
  issues: readonly CalculationIssue[];
}

/**
 * `CompareGrindingWheelsUseCase` (AP-MCE-001 Fáze E §17) - analogicky ke
 * `CompareGrindingMachinesUseCase`, jen se nahrazuje kotouč (`ToolProfile`)
 * JEDNOHO konkrétního featuru. Vyžaduje jen `calculation.read`.
 */
export class CompareGrindingWheelsUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly contextBuilder: GrindingCalculationContextBuilderPort,
    private readonly calculationEngine: CalculationEngine,
    private readonly featureAccessService: FeatureAccessService,
    private readonly eventPublisher: DomainEventPublisher
  ) {}

  async execute(input: CompareGrindingWheelsInput): Promise<GrindingWheelComparisonEntry[]> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationRead, "read");

    const entries: GrindingWheelComparisonEntry[] = [];
    for (const wheelProfileId of input.wheelProfileIds) {
      const context = await this.contextBuilder.build(input.input, tenantId, {
        wheelProfileIdOverrideByFeatureId: { [input.featureId]: wheelProfileId },
      });
      const outcome = this.calculationEngine.calculate(input.input, context);
      const issues = outcome.breakdown?.grindingDetail
        ? [...outcome.issues, ...outcome.breakdown.grindingDetail.warnings, ...outcome.breakdown.grindingDetail.recommendations]
        : outcome.issues;
      entries.push({
        wheelProfileId,
        blocked: outcome.blocked,
        totalOperationTimeMinutes: outcome.breakdown?.totalOperationTime.minutes,
        confidenceScore: outcome.breakdown?.grindingDetail?.confidenceScore,
        dressingTimeMinutes: outcome.breakdown?.grindingDetail?.dressingTimeMin,
        issues,
      });
    }

    const sorted = entries.sort((a, b) => (a.totalOperationTimeMinutes ?? Infinity) - (b.totalOperationTimeMinutes ?? Infinity));
    const bestTime = sorted.find((e) => e.totalOperationTimeMinutes !== undefined)?.totalOperationTimeMinutes;
    const bestConfidence = sorted.find((e) => e.confidenceScore !== undefined)?.confidenceScore;
    const bestDressing = sorted.find((e) => e.dressingTimeMinutes !== undefined)?.dressingTimeMinutes;
    const withDeltas = sorted.map((entry) => ({
      ...entry,
      timeDeltaMinutes: entry.totalOperationTimeMinutes !== undefined && bestTime !== undefined ? entry.totalOperationTimeMinutes - bestTime : undefined,
      confidenceDelta: entry.confidenceScore !== undefined && bestConfidence !== undefined ? entry.confidenceScore - bestConfidence : undefined,
      dressingTimeDeltaMinutes: entry.dressingTimeMinutes !== undefined && bestDressing !== undefined ? entry.dressingTimeMinutes - bestDressing : undefined,
    }));

    await this.eventPublisher.publish(
      buildCalculationEngineEvent({
        type: "grinding_wheel_comparison.completed",
        tenantId,
        entityId: input.featureId,
        actorId: input.actorId,
        correlationId: input.correlationId,
      })
    );

    return withDeltas;
  }
}
