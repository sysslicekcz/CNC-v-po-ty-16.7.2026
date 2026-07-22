export type OutlierDetectionMethod = "iqr" | "mad" | "explicit_limit" | "extreme_percentage";
export type OutlierStatus = "accepted" | "suspected" | "excluded" | "manually_included";

export interface OutlierDetectionInput {
  /** Typicky `CalibrationSample.variancePercent` napříč jedním kalibračním
   *  datasetem (§12). */
  values: readonly number[];
  /** Explicitní tenant limit (§12 "explicitní tenant limit") - MÁ PŘEDNOST
   *  před statistickými metodami (tenant zná svůj proces líp než obecný
   *  vzorec). */
  explicitTenantLimitPercent?: number;
  minimumSampleSize?: number;
  extremePercentageThreshold?: number;
}

export interface OutlierDetectionResultItem {
  index: number;
  value: number;
  outlierScore: number;
  method: OutlierDetectionMethod;
  threshold: number;
  status: OutlierStatus;
  reason: string;
  recommendation: string;
}

export interface OutlierDetectionResult {
  items: OutlierDetectionResultItem[];
  /** §12 "minimální velikost vzorku" - `true` znamená, že datový soubor je
   *  moc malý na spolehlivou statistickou detekci (IQR/MAD výsledky se pak
   *  berou jen jako orientační, ne blokující). */
  insufficientSampleSize: boolean;
}

const DEFAULT_MINIMUM_SAMPLE_SIZE = 5;
const DEFAULT_EXTREME_PERCENTAGE_THRESHOLD = 100;
/** Konzistenční konstanta MAD pro normální rozdělení (standardní volba). */
const MAD_CONSISTENCY_CONSTANT = 1.4826;
const MAD_SCORE_THRESHOLD = 3;

export function median(sorted: readonly number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function quantile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] !== undefined ? sorted[base] + rest * (sorted[base + 1] - sorted[base]) : sorted[base];
}

/**
 * `CalibrationOutlierDetector` (AP-MCE-001 Fáze G §12) - ČISTÁ funkce, čtyři
 * metody PŘESNĚ podle zadání. Outlier se NIKDY automaticky nemaže - funkce
 * vrací STAV (`status`) pro každou hodnotu, rozhodnutí "vyřadit z kalibrace"
 * dělá až `CalibrationMethod`/use case podle tohohle stavu.
 */
export function detectCalibrationOutliers(input: OutlierDetectionInput): OutlierDetectionResult {
  const minimumSampleSize = input.minimumSampleSize ?? DEFAULT_MINIMUM_SAMPLE_SIZE;
  const extremeThreshold = input.extremePercentageThreshold ?? DEFAULT_EXTREME_PERCENTAGE_THRESHOLD;
  const insufficientSampleSize = input.values.length < minimumSampleSize;

  const sorted = [...input.values].sort((a, b) => a - b);
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  const iqr = q3 - q1;
  const iqrLower = q1 - 1.5 * iqr;
  const iqrUpper = q3 + 1.5 * iqr;

  const med = median(sorted);
  const absDeviations = sorted.map((v) => Math.abs(v - med)).sort((a, b) => a - b);
  const mad = median(absDeviations) * MAD_CONSISTENCY_CONSTANT;

  const items: OutlierDetectionResultItem[] = input.values.map((value, index) => {
    if (input.explicitTenantLimitPercent !== undefined && Math.abs(value) > input.explicitTenantLimitPercent) {
      return {
        index,
        value,
        outlierScore: Math.abs(value) / input.explicitTenantLimitPercent,
        method: "explicit_limit",
        threshold: input.explicitTenantLimitPercent,
        status: "excluded",
        reason: `Hodnota ${value.toFixed(1)} % překračuje explicitní tenant limit ${input.explicitTenantLimitPercent} %.`,
        recommendation: "Vzorek zůstává vyřazený, dokud ho uživatel ručně nezahrne ('manually_included').",
      };
    }
    if (Math.abs(value) > extremeThreshold) {
      return {
        index,
        value,
        outlierScore: Math.abs(value) / extremeThreshold,
        method: "extreme_percentage",
        threshold: extremeThreshold,
        status: "suspected",
        reason: `Odchylka ${value.toFixed(1)} % přesahuje extrémní práh ${extremeThreshold} %.`,
        recommendation: "Zkontrolujte vzorek ručně před zahrnutím do kalibrace.",
      };
    }
    if (iqr > 0 && (value < iqrLower || value > iqrUpper)) {
      return {
        index,
        value,
        outlierScore: Math.abs(value - med) / iqr,
        method: "iqr",
        threshold: value < iqrLower ? iqrLower : iqrUpper,
        status: "suspected",
        reason: `Hodnota ${value.toFixed(1)} % leží mimo IQR rozsah [${iqrLower.toFixed(1)}, ${iqrUpper.toFixed(1)}].`,
        recommendation: "Doporučeno ruční posouzení - statistický outlier (IQR).",
      };
    }
    if (mad > 0 && Math.abs(value - med) / mad > MAD_SCORE_THRESHOLD) {
      return {
        index,
        value,
        outlierScore: Math.abs(value - med) / mad,
        method: "mad",
        threshold: MAD_SCORE_THRESHOLD,
        status: "suspected",
        reason: `Hodnota ${value.toFixed(1)} % je ${(Math.abs(value - med) / mad).toFixed(1)}x MAD od mediánu.`,
        recommendation: "Doporučeno ruční posouzení - statistický outlier (MAD).",
      };
    }
    return {
      index,
      value,
      outlierScore: 0,
      method: "iqr",
      threshold: iqrUpper,
      status: "accepted",
      reason: "Hodnota je v očekávaném statistickém rozsahu.",
      recommendation: "Bez zásahu.",
    };
  });

  return { items, insufficientSampleSize };
}
