import { TenantContext } from "@/domain/services/tenant-context";
import { CalculationRepository } from "@/domain/calculation-engine/repositories/calculation-repository";
import { CalculationDraftRepository } from "@/domain/calculation-engine/repositories/calculation-draft-repository";
import { ActualTimeRecordRepository } from "@/domain/calculation-engine/repositories/actual-time-record-repository";
import { CalculationVarianceRepository } from "@/domain/calculation-engine/repositories/calculation-variance-repository";
import { CalibrationProposalRepository } from "@/domain/calculation-engine/repositories/calibration-proposal-repository";
import { ShadowCalculationRepository } from "@/domain/calculation-engine/repositories/shadow-calculation-repository";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { toCalculationSummary } from "../../mappers/calculation-result-mapper";
import { CalculationSummary } from "../../dto/calculation-summary";

export interface CalculationDashboardSummary {
  draftCount: number;
  approvedCount: number;
  lowConfidenceCount: number;
  criticalWarningCount: number;
  unmatchedActualTimeCount: number;
  highVarianceOperationCount: number;
  pendingCalibrationProposalCount: number;
  activeShadowCalibrationCount: number;
  recentResults: readonly CalculationSummary[];
}

const LOW_CONFIDENCE_THRESHOLD = 0.5;
const RECENT_RESULTS_LIMIT = 5;

/**
 * `GetCalculationDashboardQuery` (AP-MCE-001 Fáze H §3/§36) - ČTECÍ
 * agregace přes existující repozitáře/use case výstupy, ŽÁDNÝ vlastní
 * přepočet metrik z raw dat (§3 "Dashboard nesmí sám počítat metriky z raw
 * dat" - metriky tady jsou prosté součty/filtry nad daty, které use cases
 * jinde v modulu už vytvořily/uložily, ne nová doménová logika).
 */
export class GetCalculationDashboardUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly calculationRepository: CalculationRepository,
    private readonly draftRepository: CalculationDraftRepository,
    private readonly actualTimeRecordRepository: ActualTimeRecordRepository,
    private readonly varianceRepository: CalculationVarianceRepository,
    private readonly calibrationProposalRepository: CalibrationProposalRepository,
    private readonly shadowCalculationRepository: ShadowCalculationRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(): Promise<CalculationDashboardSummary> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationRead, "read");

    const [drafts, results, unmatchedActualTimes, varianceAnalyses, calibrationProposals, shadowResults] = await Promise.all([
      this.draftRepository.listByTenant(tenantId),
      this.calculationRepository.listResultsByTenant(tenantId),
      this.actualTimeRecordRepository.listUnmatched(tenantId),
      this.varianceRepository.listByTenant(tenantId),
      this.calibrationProposalRepository.listByTenant(tenantId),
      this.shadowCalculationRepository.listByTenant(tenantId),
    ]);

    const summaries: CalculationSummary[] = [];
    for (const result of [...results].sort((a, b) => b.calculatedAt.localeCompare(a.calculatedAt)).slice(0, RECENT_RESULTS_LIMIT)) {
      const request = await this.calculationRepository.findRequestById(result.calculationRequestId, tenantId);
      if (request) summaries.push(toCalculationSummary(result, request));
    }

    return {
      draftCount: drafts.length,
      approvedCount: results.filter((r) => r.status === "approved").length,
      lowConfidenceCount: results.filter((r) => r.confidenceScore !== undefined && r.confidenceScore < LOW_CONFIDENCE_THRESHOLD).length,
      criticalWarningCount: results.filter((r) => r.issues.some((i) => i.severity === "error")).length,
      unmatchedActualTimeCount: unmatchedActualTimes.length,
      highVarianceOperationCount: varianceAnalyses.filter((a) => a.metrics.some((m) => m.comparable && (m.severity === "high" || m.severity === "critical"))).length,
      pendingCalibrationProposalCount: calibrationProposals.filter((p) => p.status === "generated" || p.status === "validated" || p.status === "under_review").length,
      activeShadowCalibrationCount: shadowResults.length,
      recentResults: summaries,
    };
  }
}
