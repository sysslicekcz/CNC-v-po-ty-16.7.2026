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
  rpmClampedToMachineLimit?: boolean;
  unknownPowerModel?: boolean;
  manualPassCountWithoutGeometryCheck?: boolean;
  manualOverrideUsed?: boolean;
  missingCalibrationData?: boolean;
}

/** MVP srážky za jednotlivé signály (AP-MCE-001 Fáze C §11) - hodnoty jsou
 *  zdokumentovaná odhadní konstanta, ne odvozená z kalibračních dat (ta v
 *  MVP neexistují, viz `missingCalibrationData`). */
const PENALTIES: Record<keyof ConfidenceSignals, number> = {
  usedSystemDefaultCuttingCondition: 0.1,
  missingConcreteTool: 0.15,
  toolLifeUnknown: 0.05,
  rpmClampedToMachineLimit: 0.1,
  unknownPowerModel: 0.05,
  manualPassCountWithoutGeometryCheck: 0.1,
  manualOverrideUsed: 0.1,
  missingCalibrationData: 0.05,
};

/**
 * `computeConfidence` (AP-MCE-001 Fáze C §11) - MVP heuristika 0..1. Začíná
 * na 1 (plná důvěra) a odečítá zdokumentovanou srážku za KAŽDÝ aktivní
 * negativní signál (§11 "Snižuj důvěryhodnost..."). Kladné signály (§11
 * "Zvyšuj nebo zachovej vysoké skóre...") nejsou samostatný bonus NAD 1 -
 * jsou to přesně opačné situace k negativním signálům (konkrétní nástroj =
 * `missingConcreteTool` se nespustí), takže se v tomhle jednoduchém modelu
 * projeví tím, že odpovídající srážka prostě NENASTANE.
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
