export interface ConfidenceFactor {
  reason: string;
  impact: number;
}

export interface ConfidenceBreakdown {
  baseScore: number;
  factors: ConfidenceFactor[];
  finalScore: number;
}

export interface ConfidenceSignals {
  usedSystemDefault?: boolean;
  missingTenantStandard?: boolean;
  missingHistoricalData?: boolean;
  manualEstimateWithoutTemplate?: boolean;
  unknownQualification?: boolean;
  manualOverrideUsed?: boolean;
  tooGenericSubtype?: boolean;
}

/** MVP srážky za jednotlivé signály (AP-MCE-001 Fáze F §14). */
const PENALTIES: Record<keyof ConfidenceSignals, number> = {
  usedSystemDefault: 0.1,
  missingTenantStandard: 0.1,
  missingHistoricalData: 0.05,
  manualEstimateWithoutTemplate: 0.1,
  unknownQualification: 0.1,
  manualOverrideUsed: 0.1,
  tooGenericSubtype: 0.15,
};

/**
 * `computeConfidence` (AP-MCE-001 Fáze F §14) - MVP heuristika 0..1, stejný
 * model jako Fáze C/D/E.
 */
export function computeConfidence(signals: ConfidenceSignals): ConfidenceBreakdown {
  const factors: ConfidenceFactor[] = [];
  let score = 1;
  for (const key of Object.keys(PENALTIES) as (keyof ConfidenceSignals)[]) {
    if (signals[key]) {
      const penalty = PENALTIES[key];
      score -= penalty;
      factors.push({ reason: key, impact: -penalty });
    }
  }
  const finalScore = Math.max(0, Math.min(1, score));
  return { baseScore: 1, factors, finalScore };
}
