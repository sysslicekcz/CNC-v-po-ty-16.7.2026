export interface InspectionConfidenceFactor {
  reason: string;
  impact: number;
}

export interface InspectionConfidenceBreakdown {
  baseScore: number;
  factors: InspectionConfidenceFactor[];
  finalScore: number;
}

/** AP-MCE-001 Fáze F §14 "Inspection — snižuj skóre za" - přesných 8 signálů
 *  ze zadání. */
export interface InspectionConfidenceSignals {
  unknownEquipment?: boolean;
  missingMeasurementStandard?: boolean;
  invalidCalibration?: boolean;
  manualTimeWithoutSource?: boolean;
  unknownSamplingPlan?: boolean;
  missingHistoricalData?: boolean;
  manualOverride?: boolean;
  unknownCharacteristicCount?: boolean;
}

/** MVP srážky za jednotlivé signály (AP-MCE-001 Fáze F §14) - `invalidCalibration`
 *  má nejvyšší dopad (přímé riziko neplatného protokolu). */
const PENALTIES: Record<keyof InspectionConfidenceSignals, number> = {
  unknownEquipment: 0.1,
  missingMeasurementStandard: 0.1,
  invalidCalibration: 0.25,
  manualTimeWithoutSource: 0.1,
  unknownSamplingPlan: 0.1,
  missingHistoricalData: 0.05,
  manualOverride: 0.1,
  unknownCharacteristicCount: 0.05,
};

/** `computeInspectionConfidence` (AP-MCE-001 Fáze F §14) - MVP heuristika
 *  0..1, stejný model jako `computeConfidence` (manual). */
export function computeInspectionConfidence(signals: InspectionConfidenceSignals): InspectionConfidenceBreakdown {
  const factors: InspectionConfidenceFactor[] = [];
  let score = 1;
  for (const key of Object.keys(PENALTIES) as (keyof InspectionConfidenceSignals)[]) {
    if (signals[key]) {
      const penalty = PENALTIES[key];
      score -= penalty;
      factors.push({ reason: key, impact: -penalty });
    }
  }
  const finalScore = Math.max(0, Math.min(1, score));
  return { baseScore: 1, factors, finalScore };
}
