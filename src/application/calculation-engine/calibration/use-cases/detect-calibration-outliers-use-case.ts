import { TenantContext } from "@/domain/services/tenant-context";
import { CalibrationSampleRepository } from "@/domain/calculation-engine/repositories/calibration-sample-repository";
import { detectCalibrationOutliers, OutlierDetectionResultItem } from "@/domain/calculation-engine/calibration/calibration-outlier-detector";
import { CalculationError } from "@/domain/calculation-engine/errors/calculation-error";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { DomainEventPublisher } from "@/domain/calculation-engine/events/domain-event-publisher";
import { buildCalculationEngineEvent } from "@/domain/calculation-engine/events/build-calculation-engine-event";

export interface DetectCalibrationOutliersInput {
  calibrationSampleIds: string[];
  explicitTenantLimitPercent?: number;
  minimumSampleSize?: number;
  extremePercentageThreshold?: number;
  actorId?: string;
  correlationId?: string;
}

export interface DetectCalibrationOutliersOutput {
  items: OutlierDetectionResultItem[];
  insufficientSampleSize: boolean;
}

/**
 * `DetectCalibrationOutliersUseCase` (AP-MCE-001 Fáze G §12/§22) - spustí
 * `detectCalibrationOutliers()` (Domain, čisté) nad `variancePercent`
 * VYBRANÝCH vzorků a uloží zpět jen ty, které `status !== "accepted"`
 * (§12 "Outlier se NIKDY automaticky nemaže" - `withOutlierExclusion()`
 * pouze označí `included: false`, řádek zůstává v repozitáři).
 */
export class DetectCalibrationOutliersUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly repository: CalibrationSampleRepository,
    private readonly featureAccessService: FeatureAccessService,
    private readonly eventPublisher: DomainEventPublisher
  ) {}

  async execute(input: DetectCalibrationOutliersInput): Promise<DetectCalibrationOutliersOutput> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationCalibrationCreate, "write");

    const samples = await Promise.all(input.calibrationSampleIds.map((id) => this.repository.getById(id, tenantId)));
    const missingIndex = samples.findIndex((s) => !s);
    if (missingIndex >= 0) throw new CalculationError(`CalibrationSample "${input.calibrationSampleIds[missingIndex]}" nebyl nalezen.`);
    const resolvedSamples = samples.filter((s): s is NonNullable<typeof s> => s !== null);

    const detection = detectCalibrationOutliers({
      values: resolvedSamples.map((s) => s.variancePercent),
      explicitTenantLimitPercent: input.explicitTenantLimitPercent,
      minimumSampleSize: input.minimumSampleSize,
      extremePercentageThreshold: input.extremePercentageThreshold,
    });

    // §12 "Outlier nesmí být automaticky vymazán" - JEN `"excluded"` (explicitní
    // tenant limit) se promítne do `included: false`. `"suspected"` (IQR/MAD/
    // extrémní %) zůstává `included`, jen OZNAČENÝ pro ruční revizi - volající
    // (UI/review use case) rozhodne o `"manually_included"`/vyřazení sám.
    for (const item of detection.items) {
      if (item.status === "excluded") {
        const sample = resolvedSamples[item.index];
        await this.repository.save(sample.withOutlierExclusion("statistical_outlier"));
      }
    }

    await this.eventPublisher.publish(
      buildCalculationEngineEvent({ type: "calibration_outliers.detected", tenantId, entityId: crypto.randomUUID(), actorId: input.actorId, correlationId: input.correlationId })
    );

    return detection;
  }
}
