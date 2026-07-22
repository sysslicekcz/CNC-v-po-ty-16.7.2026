import { ValidationError } from "@/domain/errors/validation-error";
import { CalculationBreakdown } from "../entities/calculation-breakdown";
import { analyzeCalculationVariance, CalculationVarianceAnalysis } from "./calculation-variance";
import type { AnalyzeVarianceInput } from "./calculation-variance";

export interface ShadowCalculationResultProps {
  id: string;
  tenantId: string;
  officialCalculationId: string;
  officialCalculationRevision: number;
  shadowCalibrationProfileId: string;
  shadowCalibrationProfileVersion: number;
  /** `CalculationBreakdown.toJSON()` výstup - ploché, serializovatelné data,
   *  stejný důvod jako `CalculationResult.materialProfileSnapshot` (Fáze B) -
   *  shadow výsledek NIKDY nesmí přepsat/ovlivnit oficiální `CalculationResult`
   *  (§20 "neovlivní oficiální CalculationResult"). */
  shadowBreakdown: Readonly<Record<string, unknown>>;
  shadowTotalOperationTimeMin: number;
  officialTotalOperationTimeMin: number;
  computedAt: string;
}

/**
 * `ShadowCalculationResult` (AP-MCE-001 Fáze G §20) - PARALELNÍ výsledek
 * spočítaný se stínovým `CalibrationProfile` (status `"active"` NENÍ
 * podmínkou pro shadow běh - `RunCalibrationShadowModeUseCase` smí použít i
 * `"under_review"` profil, viz jeho komentář) - uložen VEDLE oficiálního
 * `CalculationResult`, nikdy ho nenahrazuje ani nemění.
 */
export class ShadowCalculationResult {
  private readonly props: Readonly<ShadowCalculationResultProps>;

  private constructor(props: ShadowCalculationResultProps) {
    this.props = Object.freeze({ ...props, shadowBreakdown: Object.freeze({ ...props.shadowBreakdown }) });
  }

  static create(props: ShadowCalculationResultProps): ShadowCalculationResult {
    if (!props.id.trim()) throw new ValidationError("ShadowCalculationResult: 'id' nesmí být prázdné.");
    if (!props.tenantId.trim()) throw new ValidationError("ShadowCalculationResult: 'tenantId' nesmí být prázdné.");
    if (!props.officialCalculationId.trim()) throw new ValidationError("ShadowCalculationResult: 'officialCalculationId' nesmí být prázdné.");
    return new ShadowCalculationResult(props);
  }

  get id(): string {
    return this.props.id;
  }
  get tenantId(): string {
    return this.props.tenantId;
  }
  get officialCalculationId(): string {
    return this.props.officialCalculationId;
  }
  get officialCalculationRevision(): number {
    return this.props.officialCalculationRevision;
  }
  get shadowCalibrationProfileId(): string {
    return this.props.shadowCalibrationProfileId;
  }
  get shadowCalibrationProfileVersion(): number {
    return this.props.shadowCalibrationProfileVersion;
  }
  get shadowBreakdown(): Readonly<Record<string, unknown>> {
    return this.props.shadowBreakdown;
  }
  get shadowTotalOperationTimeMin(): number {
    return this.props.shadowTotalOperationTimeMin;
  }
  get officialTotalOperationTimeMin(): number {
    return this.props.officialTotalOperationTimeMin;
  }
  get differenceMin(): number {
    return this.props.shadowTotalOperationTimeMin - this.props.officialTotalOperationTimeMin;
  }
  get differencePercent(): number {
    return this.props.officialTotalOperationTimeMin > 0 ? (this.differenceMin / this.props.officialTotalOperationTimeMin) * 100 : 0;
  }
  get computedAt(): string {
    return this.props.computedAt;
  }

  toPlainObject(): Record<string, unknown> {
    return { ...this.props, shadowBreakdown: { ...this.props.shadowBreakdown }, differenceMin: this.differenceMin, differencePercent: this.differencePercent };
  }
}

export interface ShadowVarianceAnalysis {
  shadowCalculationResultId: string;
  analysis: CalculationVarianceAnalysis;
}

/** `ShadowVarianceAnalysis` (AP-MCE-001 Fáze G §20) - znovupoužije PŘESNĚ
 *  stejnou `analyzeCalculationVariance()` (§8) jako oficiální výpočty, jen
 *  nad stínovým `CalculationBreakdown` - žádná paralelní analytická logika
 *  (§20 zadání implicitně "shadow" znamená JINÝ vstup do STEJNÉHO mechanismu,
 *  ne jiný mechanismus). */
export function analyzeShadowVariance(shadowResultId: string, breakdown: CalculationBreakdown, rest: Omit<AnalyzeVarianceInput, "breakdown">): ShadowVarianceAnalysis {
  return { shadowCalculationResultId: shadowResultId, analysis: analyzeCalculationVariance({ ...rest, breakdown }) };
}

export type ShadowCalibrationRecommendation = "promote" | "keep_shadow" | "reject";

export interface ShadowCalibrationEvaluation {
  calibrationProfileId: string;
  calibrationProfileVersion: number;
  sampleCount: number;
  officialMaeMin: number;
  shadowMaeMin: number;
  improvementPercent: number;
  recommendation: ShadowCalibrationRecommendation;
  evaluatedAt: string;
}

const MIN_SAMPLES_FOR_PROMOTION_DECISION = 10;
const PROMOTION_IMPROVEMENT_THRESHOLD_PERCENT = 5;
const REJECTION_WORSENING_THRESHOLD_PERCENT = -5;

function mean(values: readonly number[]): number {
  return values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;
}

/**
 * `ShadowCalibrationEvaluation` tvůrce (AP-MCE-001 Fáze G §20) - "vyhodnotí
 * přínos" nasbíraných párů (oficiální chyba vs. stínová chyba, jeden pár na
 * `ActualTimeRecord`, jakmile dorazí) a doporučí `"promote"` (aktivovat
 * naostro), `"reject"`, nebo `"keep_shadow"` (sbírat dál) - NIKDY sám
 * neaktivuje `CalibrationProfile`, jen doporučí (§21 "Žádné schválení nesmí
 * být pouze v UI" platí i tady - aktivaci provede až
 * `ActivateCalibrationProfileUseCase` po lidském schválení).
 */
export function evaluateShadowCalibration(
  pairs: readonly { officialErrorMin: number; shadowErrorMin: number }[],
  profileId: string,
  profileVersion: number,
  now: string
): ShadowCalibrationEvaluation {
  const sampleCount = pairs.length;
  const officialMaeMin = mean(pairs.map((p) => Math.abs(p.officialErrorMin)));
  const shadowMaeMin = mean(pairs.map((p) => Math.abs(p.shadowErrorMin)));
  const improvementPercent = officialMaeMin > 0 ? ((officialMaeMin - shadowMaeMin) / officialMaeMin) * 100 : 0;

  let recommendation: ShadowCalibrationRecommendation = "keep_shadow";
  if (sampleCount >= MIN_SAMPLES_FOR_PROMOTION_DECISION) {
    if (improvementPercent > PROMOTION_IMPROVEMENT_THRESHOLD_PERCENT) recommendation = "promote";
    else if (improvementPercent < REJECTION_WORSENING_THRESHOLD_PERCENT) recommendation = "reject";
  }

  return {
    calibrationProfileId: profileId,
    calibrationProfileVersion: profileVersion,
    sampleCount,
    officialMaeMin,
    shadowMaeMin,
    improvementPercent,
    recommendation,
    evaluatedAt: now,
  };
}
