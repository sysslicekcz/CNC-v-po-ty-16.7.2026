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
  usedSystemDefaultCuttingCondition?: boolean;
  missingConcreteWheel?: boolean;
  wheelLifeUnknown?: boolean;
  dressingIntervalDefaulted?: boolean;
  centerlessApproximation?: boolean;
  creepFeedApproximation?: boolean;
  manualPassCountUsed?: boolean;
  unknownMeasurement?: boolean;
  unknownMachinePrecision?: boolean;
  rpmClampedToMachineLimit?: boolean;
  manualOverrideUsed?: boolean;
  missingCalibrationData?: boolean;
}

/** MVP srážky za jednotlivé signály (AP-MCE-001 Fáze E §14) - stejná
 *  filozofie jako Fáze C/D `PENALTIES`. Centerless/creep-feed aproximace mají
 *  nejvyšší srážku (§5/§6 "sniž confidenceScore", nejméně přesné modely). */
const PENALTIES: Record<keyof ConfidenceSignals, number> = {
  usedSystemDefaultCuttingCondition: 0.1,
  missingConcreteWheel: 0.15,
  wheelLifeUnknown: 0.05,
  dressingIntervalDefaulted: 0.05,
  centerlessApproximation: 0.15,
  creepFeedApproximation: 0.15,
  manualPassCountUsed: 0.1,
  unknownMeasurement: 0.05,
  unknownMachinePrecision: 0.05,
  rpmClampedToMachineLimit: 0.1,
  manualOverrideUsed: 0.1,
  missingCalibrationData: 0.05,
};

/**
 * `computeConfidence` (AP-MCE-001 Fáze E §14) - MVP heuristika 0..1, stejný
 * model jako Fáze C/D `computeConfidence`.
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
