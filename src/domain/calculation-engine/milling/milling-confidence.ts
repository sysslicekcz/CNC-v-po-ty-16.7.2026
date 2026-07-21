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
  missingConcreteTool?: boolean;
  toolLifeUnknown?: boolean;
  derivedPathInsteadOfExplicit?: boolean;
  threeDApproximation?: boolean;
  rpmClampedToMachineLimit?: boolean;
  feedClampedToMachineLimit?: boolean;
  unknownPowerModel?: boolean;
  manualPassCountWithoutGeometryCheck?: boolean;
  missingCalibrationData?: boolean;
  unsuitableTool?: boolean;
  manualOverrideUsed?: boolean;
}

/** MVP srážky za jednotlivé signály (AP-MCE-001 Fáze D §12) - stejná
 *  filozofie jako Fáze C `PENALTIES`: zdokumentovaná odhadní konstanta, ne
 *  odvozená z kalibračních dat. 3D aproximace má NEJVYŠŠÍ srážku (§4/§12 -
 *  "výsledek označ nižším confidenceScore", jde o nejméně přesný model). */
const PENALTIES: Record<keyof ConfidenceSignals, number> = {
  usedSystemDefaultCuttingCondition: 0.1,
  missingConcreteTool: 0.15,
  toolLifeUnknown: 0.05,
  derivedPathInsteadOfExplicit: 0.05,
  threeDApproximation: 0.15,
  rpmClampedToMachineLimit: 0.1,
  feedClampedToMachineLimit: 0.1,
  unknownPowerModel: 0.05,
  manualPassCountWithoutGeometryCheck: 0.1,
  missingCalibrationData: 0.05,
  unsuitableTool: 0.1,
  manualOverrideUsed: 0.1,
};

/**
 * `computeConfidence` (AP-MCE-001 Fáze D §12) - MVP heuristika 0..1, stejný
 * model jako Fáze C `computeConfidence`: začíná na 1 a odečítá zdokumentovanou
 * srážku za KAŽDÝ aktivní negativní signál.
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
