import { TenantContext } from "@/domain/services/tenant-context";
import { CalibrationProposalRepository } from "@/domain/calculation-engine/repositories/calibration-proposal-repository";
import { CalibrationSampleRepository } from "@/domain/calculation-engine/repositories/calibration-sample-repository";
import { splitSamplesForBacktest, runCalibrationBacktest, BacktestSplitMethod, CalibrationBacktestResult } from "@/domain/calculation-engine/calibration/calibration-backtest-service";
import { CalibrationCoefficientTargetName } from "@/domain/calculation-engine/calibration/coefficient-target";
import { CalculationError } from "@/domain/calculation-engine/errors/calculation-error";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { DomainEventPublisher } from "@/domain/calculation-engine/events/domain-event-publisher";
import { buildCalculationEngineEvent } from "@/domain/calculation-engine/events/build-calculation-engine-event";

export interface BacktestCalibrationProposalInput {
  proposalId: string;
  splitMethod: BacktestSplitMethod;
  trainingRatio?: number;
  explicitValidationPeriod?: { from: string; to: string };
  actorId?: string;
  correlationId?: string;
}

/**
 * `BacktestCalibrationProposalUseCase` (AP-MCE-001 Fáze G §17/§22) - rozdělí
 * `proposal.sourceSampleIds` na training/validation (§17 tři metody) a spustí
 * `runCalibrationBacktest()` (Domain) PRO KAŽDÝ cílový koeficient návrhu -
 * `passed` je AND přes všechny cíle (jeden zhoršený cíl stačí na neúspěch,
 * §17 "nesmí být schválena automaticky jen proto, že zlepší průměr").
 */
export class BacktestCalibrationProposalUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly proposalRepository: CalibrationProposalRepository,
    private readonly sampleRepository: CalibrationSampleRepository,
    private readonly featureAccessService: FeatureAccessService,
    private readonly eventPublisher: DomainEventPublisher
  ) {}

  async execute(input: BacktestCalibrationProposalInput): Promise<{ proposal: Record<string, unknown>; results: CalibrationBacktestResult[] }> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationCalibrationCreate, "write");

    const proposal = await this.proposalRepository.getById(input.proposalId, tenantId);
    if (!proposal) throw new CalculationError(`CalibrationProposal "${input.proposalId}" nebyl nalezen.`);

    const samples = (await Promise.all(proposal.sourceSampleIds.map((id) => this.sampleRepository.getById(id, tenantId)))).filter((s): s is NonNullable<typeof s> => s !== null);

    const { validationSamples } = splitSamplesForBacktest({
      samples,
      method: input.splitMethod,
      trainingRatio: input.trainingRatio,
      explicitValidationPeriod: input.explicitValidationPeriod,
    });

    const targetNames = Object.keys(proposal.proposedCoefficients) as CalibrationCoefficientTargetName[];
    const results = targetNames.map((targetName) =>
      runCalibrationBacktest({
        targetName,
        originalValue: proposal.currentCoefficients[targetName] ?? 1,
        proposedValue: proposal.proposedCoefficients[targetName] ?? 1,
        validationSamples,
      })
    );

    const overallPassed = results.length > 0 && results.every((r) => r.passed);
    const worstMae = results.reduce((worst, r) => Math.max(worst, r.maeBeforeMin), 0);
    const worstMaeAfter = results.reduce((worst, r) => Math.max(worst, r.maeAfterMin), 0);

    const updated = proposal.withValidationResult({
      backtestId: crypto.randomUUID(),
      passed: overallPassed,
      maeBeforeMin: worstMae,
      maeAfterMin: worstMaeAfter,
    });
    await this.proposalRepository.save(updated);

    await this.eventPublisher.publish(
      buildCalculationEngineEvent({ type: "calibration_proposal.backtested", tenantId, entityId: proposal.id, actorId: input.actorId, correlationId: input.correlationId })
    );

    return { proposal: updated.toPlainObject(), results };
  }
}
