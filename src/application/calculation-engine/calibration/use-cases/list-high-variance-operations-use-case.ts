import { TenantContext } from "@/domain/services/tenant-context";
import { CalculationVarianceRepository } from "@/domain/calculation-engine/repositories/calculation-variance-repository";
import { CalculationVarianceAnalysis } from "@/domain/calculation-engine/calibration/calculation-variance";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";

/** `ListHighVarianceOperationsUseCase` (AP-MCE-001 Fáze G §22) - přehled
 *  operací, u kterých aspoň jedna metrika vyšla "high"/"critical" (§8) -
 *  čtecí use case, žádná mutace/událost. */
export class ListHighVarianceOperationsUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly repository: CalculationVarianceRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(): Promise<CalculationVarianceAnalysis[]> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationCalibrationRead, "read");

    const all = await this.repository.listByTenant(tenantId);
    return all.filter((analysis) => analysis.metrics.some((m) => m.comparable && (m.severity === "high" || m.severity === "critical")));
  }
}
