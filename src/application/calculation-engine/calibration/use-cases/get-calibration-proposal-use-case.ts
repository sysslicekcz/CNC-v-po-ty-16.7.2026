import { TenantContext } from "@/domain/services/tenant-context";
import { CalibrationProposalRepository } from "@/domain/calculation-engine/repositories/calibration-proposal-repository";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";

/** `GetCalibrationProposalUseCase` (AP-MCE-001 Fáze H §22
 *  "CalibrationProposalPage"). */
export class GetCalibrationProposalUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly calibrationProposalRepository: CalibrationProposalRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(id: string): Promise<Record<string, unknown> | null> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationCalibrationRead, "read");
    const proposal = await this.calibrationProposalRepository.getById(id, tenantId);
    return proposal ? proposal.toPlainObject() : null;
  }
}
