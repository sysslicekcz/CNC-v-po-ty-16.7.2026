import { TenantContext } from "@/domain/services/tenant-context";
import { CalibrationProfileRepository } from "@/domain/calculation-engine/repositories/calibration-profile-repository";
import { CalibrationProposalRepository } from "@/domain/calculation-engine/repositories/calibration-proposal-repository";
import { CalibrationSampleRepository } from "@/domain/calculation-engine/repositories/calibration-sample-repository";
import { ShadowCalculationRepository } from "@/domain/calculation-engine/repositories/shadow-calculation-repository";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";

export interface CalibrationDashboardSummary {
  activeProfileCount: number;
  profilesAwaitingReviewCount: number;
  proposalsAwaitingApprovalCount: number;
  usableSampleCount: number;
  outlierSuspectedCount: number;
  shadowResultCount: number;
  lastActivatedProfile?: { id: string; name: string; activatedAt: string };
  lowConfidenceProfileCount: number;
}

const LOW_CONFIDENCE_THRESHOLD = 0.5;

/** `GetCalibrationDashboardQuery` (AP-MCE-001 Fáze H §22/§36) - čtecí
 *  agregace nad Fáze G repozitáři, žádná nová kalibrační logika. */
export class GetCalibrationDashboardUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly calibrationProfileRepository: CalibrationProfileRepository,
    private readonly calibrationProposalRepository: CalibrationProposalRepository,
    private readonly calibrationSampleRepository: CalibrationSampleRepository,
    private readonly shadowCalculationRepository: ShadowCalculationRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(): Promise<CalibrationDashboardSummary> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationCalibrationRead, "read");

    const [profiles, proposals, samples, shadowResults] = await Promise.all([
      this.calibrationProfileRepository.listByTenant(tenantId),
      this.calibrationProposalRepository.listByTenant(tenantId),
      this.calibrationSampleRepository.listByTenant(tenantId),
      this.shadowCalculationRepository.listByTenant(tenantId),
    ]);

    const activeProfiles = profiles.filter((p) => p.status === "active");
    const lastActivated = [...activeProfiles].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];

    return {
      activeProfileCount: activeProfiles.length,
      profilesAwaitingReviewCount: profiles.filter((p) => p.status === "under_review" || p.status === "calculated").length,
      proposalsAwaitingApprovalCount: proposals.filter((p) => p.status === "validated" || p.status === "under_review").length,
      usableSampleCount: samples.filter((s) => s.included).length,
      outlierSuspectedCount: samples.filter((s) => !s.included && s.exclusionReason === "statistical_outlier").length,
      shadowResultCount: shadowResults.length,
      lastActivatedProfile: lastActivated ? { id: lastActivated.id, name: lastActivated.name, activatedAt: lastActivated.updatedAt } : undefined,
      lowConfidenceProfileCount: activeProfiles.filter((p) => p.confidenceScore < LOW_CONFIDENCE_THRESHOLD).length,
    };
  }
}
