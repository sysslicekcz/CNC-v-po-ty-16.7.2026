import { TenantContext } from "@/domain/services/tenant-context";
import { CalculationEngine } from "@/domain/calculation-engine/services/calculation-engine";
import { CalculationIssue } from "@/domain/calculation-engine/entities/types";
import { MillingCalculationInput } from "@/domain/calculation-engine/milling/milling-calculation-input";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { DomainEventPublisher } from "@/domain/calculation-engine/events/domain-event-publisher";
import { buildCalculationEngineEvent } from "@/domain/calculation-engine/events/build-calculation-engine-event";
import { MillingCalculationContextBuilderPort } from "../milling-calculation-context-builder";

export interface CompareMillingToolsInput {
  input: MillingCalculationInput;
  /** Který `MillingFeature` se porovnává - různé featury mohou používat
   *  různé nástroje (§3). */
  featureId: string;
  toolProfileIds: readonly string[];
  actorId?: string;
  correlationId?: string;
}

export interface MillingToolComparisonEntry {
  toolProfileId: string;
  blocked: boolean;
  totalOperationTimeMinutes?: number;
  confidenceScore?: number;
  timeDeltaMinutes?: number;
  confidenceDelta?: number;
  issues: readonly CalculationIssue[];
}

/**
 * `CompareMillingToolsUseCase` (AP-MCE-001 Fáze D §15) - analogicky ke
 * `CompareMillingMachinesUseCase`, jen se nahrazuje `ToolProfile` JEDNOHO
 * konkrétního featuru. Vyžaduje jen `calculation.read`.
 */
export class CompareMillingToolsUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly contextBuilder: MillingCalculationContextBuilderPort,
    private readonly calculationEngine: CalculationEngine,
    private readonly featureAccessService: FeatureAccessService,
    private readonly eventPublisher: DomainEventPublisher
  ) {}

  async execute(input: CompareMillingToolsInput): Promise<MillingToolComparisonEntry[]> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationRead, "read");

    const entries: MillingToolComparisonEntry[] = [];
    for (const toolProfileId of input.toolProfileIds) {
      const context = await this.contextBuilder.build(input.input, tenantId, {
        toolProfileIdOverrideByFeatureId: { [input.featureId]: toolProfileId },
      });
      const outcome = this.calculationEngine.calculate(input.input, context);
      const issues = outcome.breakdown?.millingDetail
        ? [...outcome.issues, ...outcome.breakdown.millingDetail.warnings, ...outcome.breakdown.millingDetail.recommendations]
        : outcome.issues;
      entries.push({
        toolProfileId,
        blocked: outcome.blocked,
        totalOperationTimeMinutes: outcome.breakdown?.totalOperationTime.minutes,
        confidenceScore: outcome.breakdown?.millingDetail?.confidenceScore,
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
        type: "milling_tool_comparison.completed",
        tenantId,
        entityId: input.featureId,
        actorId: input.actorId,
        correlationId: input.correlationId,
      })
    );

    return withDeltas;
  }
}
