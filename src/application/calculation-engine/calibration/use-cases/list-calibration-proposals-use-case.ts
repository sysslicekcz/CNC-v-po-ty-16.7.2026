import { TenantContext } from "@/domain/services/tenant-context";
import { CalibrationProposalRepository } from "@/domain/calculation-engine/repositories/calibration-proposal-repository";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";

/** `ListCalibrationProposalsUseCase` (AP-MCE-001 Fáze H §22
 *  "CalibrationDashboardPage") - plochý výpis všech `CalibrationProposal`
 *  (`toPlainObject()`, stejný vzor jako `ListCalculationDraftsUseCase`). */
export class ListCalibrationProposalsUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly calibrationProposalRepository: CalibrationProposalRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(): Promise<Record<string, unknown>[]> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationCalibrationRead, "read");
    const proposals = await this.calibrationProposalRepository.listByTenant(tenantId);
    return proposals.map((p) => p.toPlainObject()).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }
}
