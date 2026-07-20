import { TenantContext } from "@/domain/services/tenant-context";
import { CalculationEngine } from "@/domain/calculation-engine/services/calculation-engine";
import { CalculationIssue } from "@/domain/calculation-engine/entities/types";
import { TurningCalculationInput } from "@/domain/calculation-engine/turning/turning-calculation-input";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { DomainEventPublisher } from "@/domain/calculation-engine/events/domain-event-publisher";
import { buildCalculationEngineEvent } from "@/domain/calculation-engine/events/build-calculation-engine-event";
import { TurningCalculationContextBuilderPort } from "../turning-calculation-context-builder";

export interface CompareTurningToolsInput {
  input: TurningCalculationInput;
  /** Který `TurningFeature` se porovnává - různé featury mohou používat
   *  různé nástroje (§3), porovnání proto musí říct, PRO KTERÝ feature se
   *  `toolProfileIds` zkouší. */
  featureId: string;
  toolProfileIds: readonly string[];
  actorId?: string;
  correlationId?: string;
}

export interface TurningToolComparisonEntry {
  toolProfileId: string;
  blocked: boolean;
  totalOperationTimeMinutes?: number;
  confidenceScore?: number;
  timeDeltaMinutes?: number;
  confidenceDelta?: number;
  issues: readonly CalculationIssue[];
}

/**
 * `CompareTurningToolsUseCase` (AP-MCE-001 Fáze C §14) - analogicky ke
 * `CompareTurningMachinesUseCase`, jen se nahrazuje `ToolProfile` JEDNOHO
 * konkrétního featuru (`featureId`), ne celý stroj. Vyžaduje jen
 * `calculation.read`.
 */
export class CompareTurningToolsUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly contextBuilder: TurningCalculationContextBuilderPort,
    private readonly calculationEngine: CalculationEngine,
    private readonly featureAccessService: FeatureAccessService,
    private readonly eventPublisher: DomainEventPublisher
  ) {}

  async execute(input: CompareTurningToolsInput): Promise<TurningToolComparisonEntry[]> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationRead, "read");

    const entries: TurningToolComparisonEntry[] = [];
    for (const toolProfileId of input.toolProfileIds) {
      const context = await this.contextBuilder.build(input.input, tenantId, {
        toolProfileIdOverrideByFeatureId: { [input.featureId]: toolProfileId },
      });
      const outcome = this.calculationEngine.calculate(input.input, context);
      const issues = outcome.breakdown?.turningDetail
        ? [...outcome.issues, ...outcome.breakdown.turningDetail.warnings, ...outcome.breakdown.turningDetail.recommendations]
        : outcome.issues;
      entries.push({
        toolProfileId,
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
        type: "turning_tool_comparison.completed",
        tenantId,
        entityId: input.featureId,
        actorId: input.actorId,
        correlationId: input.correlationId,
      })
    );

    return withDeltas;
  }
}
