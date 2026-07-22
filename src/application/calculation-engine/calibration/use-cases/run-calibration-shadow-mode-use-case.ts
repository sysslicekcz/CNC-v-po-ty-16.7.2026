import { TenantContext } from "@/domain/services/tenant-context";
import { CalculationRepository } from "@/domain/calculation-engine/repositories/calculation-repository";
import { CalibrationProfileRepository } from "@/domain/calculation-engine/repositories/calibration-profile-repository";
import { ShadowCalculationRepository } from "@/domain/calculation-engine/repositories/shadow-calculation-repository";
import { ShadowCalculationResult } from "@/domain/calculation-engine/calibration/shadow-mode";
import { CalculationError } from "@/domain/calculation-engine/errors/calculation-error";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { DomainEventPublisher } from "@/domain/calculation-engine/events/domain-event-publisher";
import { buildCalculationEngineEvent } from "@/domain/calculation-engine/events/build-calculation-engine-event";

export interface RunCalibrationShadowModeInput {
  officialCalculationId: string;
  officialCalculationRevision: number;
  shadowCalibrationProfileId: string;
  actorId?: string;
  correlationId?: string;
}

/**
 * `RunCalibrationShadowModeUseCase` (AP-MCE-001 Fáze G §20/§22) - spočítá
 * ALTERNATIVNÍ výsledek se stínovým `CalibrationProfile`, ULOŽÍ ho VEDLE
 * oficiálního `CalculationResult` (§20 "neovlivní oficiální
 * CalculationResult") a NIKDY nemutuje/nenahrazuje original.
 *
 * MVP zjednodušení (zdokumentováno, stejná disciplína jako u `Calibration
 * BacktestService`): "skutečné" stínové přepočítání by vyžadovalo znovu
 * sestavit celý `CalculationContext` a zavolat `CalculationStrategy` s
 * jinými koeficienty (plné napojení `CalibrationProfile` do
 * `CalculationContextResolver` je mimo rozsah Fáze G, viz `Resolve
 * CalibrationProfileUseCase` komentář a finální souhrn "zbývající rizika") -
 * tenhle use case proto aplikuje stínové koeficienty jako LINEÁRNÍ škálování
 * nad už hotovým oficiálním `totalOperationTime`, stejný předpoklad jako
 * `CalibrationMethod`/`CalibrationBacktestService`.
 */
export class RunCalibrationShadowModeUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly calculationRepository: CalculationRepository,
    private readonly calibrationProfileRepository: CalibrationProfileRepository,
    private readonly shadowRepository: ShadowCalculationRepository,
    private readonly featureAccessService: FeatureAccessService,
    private readonly eventPublisher: DomainEventPublisher
  ) {}

  async execute(input: RunCalibrationShadowModeInput): Promise<Record<string, unknown>> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationCalibrationCreate, "write");

    const officialResult = await this.calculationRepository.findResultById(input.officialCalculationId, tenantId);
    if (!officialResult || !officialResult.breakdown) throw new CalculationError(`CalculationResult "${input.officialCalculationId}" nebyl nalezen nebo nemá breakdown.`);

    const shadowProfile = await this.calibrationProfileRepository.getById(input.shadowCalibrationProfileId, tenantId);
    if (!shadowProfile) throw new CalculationError(`CalibrationProfile "${input.shadowCalibrationProfileId}" nebyl nalezen.`);

    const officialTotalOperationTimeMin = officialResult.breakdown.totalOperationTime.minutes;
    const coefficientValues = Object.values(shadowProfile.coefficientValues).filter((v): v is number => v !== undefined);
    const combinedRatio = coefficientValues.length > 0 ? coefficientValues.reduce((product, v) => product * v, 1) : 1;
    const shadowTotalOperationTimeMin = officialTotalOperationTimeMin * combinedRatio;

    const now = new Date().toISOString();
    const shadowResult = ShadowCalculationResult.create({
      id: crypto.randomUUID(),
      tenantId,
      officialCalculationId: input.officialCalculationId,
      officialCalculationRevision: input.officialCalculationRevision,
      shadowCalibrationProfileId: shadowProfile.id,
      shadowCalibrationProfileVersion: shadowProfile.recordVersion,
      shadowBreakdown: { ...officialResult.breakdown.toJSON(), shadowCoefficientRatio: combinedRatio },
      shadowTotalOperationTimeMin,
      officialTotalOperationTimeMin,
      computedAt: now,
    });

    await this.shadowRepository.save(shadowResult);
    await this.eventPublisher.publish(
      buildCalculationEngineEvent({ type: "calibration_shadow.completed", tenantId, entityId: shadowResult.id, actorId: input.actorId, correlationId: input.correlationId })
    );

    return shadowResult.toPlainObject();
  }
}
