import { TenantContext } from "@/domain/services/tenant-context";
import { CalibrationProfileRepository } from "@/domain/calculation-engine/repositories/calibration-profile-repository";
import { resolveCalibrationProfile, CalibrationProfileResolution } from "@/domain/calculation-engine/calibration/calibration-profile-resolver";
import type { OperationCategory } from "@/domain/calculation-engine/enums/operation-category";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";

export interface ResolveCalibrationProfileInput {
  operationCategory: OperationCategory;
  operationSubtype?: string;
  siteId?: string;
  machineProfileId?: string;
  materialGroupId?: string;
  toolTypeId?: string;
  workstationId?: string;
}

/**
 * `ResolveCalibrationProfileUseCase` (AP-MCE-001 Fáze G §19/§22) - JEDINÉ
 * místo, které `CalculationContextResolver` (existující, Fáze B) smí volat,
 * aby do `CalculationContext` doplnil kalibrační koeficienty (§19
 * "CalculationContextResolver musí použít pouze active, approved, časově
 * platný, tenantově správný profil" - filtrace na `listActiveCandidates`
 * PLUS `resolveCalibrationProfile()` samo znovu kontroluje `isUsableInCalculation`).
 */
export class ResolveCalibrationProfileUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly repository: CalibrationProfileRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(input: ResolveCalibrationProfileInput): Promise<CalibrationProfileResolution> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationCalibrationRead, "read");

    const candidates = await this.repository.listActiveCandidates(tenantId);
    return resolveCalibrationProfile({
      candidates,
      tenantId,
      siteId: input.siteId,
      operationCategory: input.operationCategory,
      operationSubtype: input.operationSubtype,
      machineProfileId: input.machineProfileId,
      materialGroupId: input.materialGroupId,
      toolTypeId: input.toolTypeId,
      workstationId: input.workstationId,
      now: new Date().toISOString(),
    });
  }
}
