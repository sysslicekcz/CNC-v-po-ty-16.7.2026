import type { MeasurementRequirement } from "./grinding-subtype";

/** Vstup pro `resolveMeasurementStrategy()` (AP-MCE-001 Fáze E §11). */
export interface MeasurementStrategyInput {
  measurementRequirement: MeasurementRequirement;
  /** §2/§11 "měření po určitém počtu průchodů"/"měření každého N-tého kusu" -
   *  alternativa k `"sampling"` s KONKRÉTNÍM intervalem místo obecného "50 %". */
  measurementFrequencyPieces?: number;
  /** Čas JEDNOHO měřicího cyklu (zastavení + měření + návrat do řezu, §11 -
   *  "Započítej: čas zastavení, čas měření, čas návratu do řezu"), MVP
   *  nerozlišuje tyhle tři složky samostatně (jedna položka je zdokumentovaná
   *  agregace, stejná úroveň detailu jako Fáze C/D `measurementTimePerPieceMin`). */
  measurementTimeMin?: number;
  /** §11 "korekční přebroušení po měření" - `true`, pokud se u featuru
   *  počítá s korekčním průchodem po měření (typicky dokončovací featury s
   *  přísnou tolerancí). */
  correctionPassOnDeviation?: boolean;
  correctionPassTimeMin?: number;
}

export interface MeasurementResolution {
  /** Počet měřicích událostí PŘIPADAJÍCÍCH NA KUS (0, 0.5 pro sampling, nebo 1) -
   *  informativní, skutečný čas nesou pole níž. */
  measurementEventsPerPiece: number;
  /** Čas měření, který se škáluje s počtem kusů (jde do `batchVariableTime`). */
  variableMeasurementTimeMin: number;
  /** Čas měření PRVNÍHO kusu navíc (jde do `batchFixedTime` přes
   *  `firstPieceInspectionTimeMin`). */
  firstPieceMeasurementTimeMin: number;
  /** §11 "Korekční průchod musí být explicitní a vysvětlitelný" - čas
   *  korekčního přebroušení, škáluje se stejně jako `variableMeasurementTimeMin`
   *  (jeden na kus, kde se měření provádí). */
  correctionPassContributionMin: number;
}

/**
 * `resolveMeasurementStrategy` (AP-MCE-001 Fáze E §11) - ČISTÁ funkce, žádné
 * I/O. Formalizuje politiku měření (stejnou sémantiku jako Fáze C/D
 * `measurementRequirement` větvení uvnitř strategie) do samostatné,
 * testovatelné jednotky a navíc přidává `measurementFrequencyPieces`
 * (měření po N kusech) a explicitní korekční průchod.
 */
export function resolveMeasurementStrategy(input: MeasurementStrategyInput): MeasurementResolution {
  const measurementTimeMin = input.measurementTimeMin ?? 0;
  const correctionPassTimeMin = input.correctionPassOnDeviation ? (input.correctionPassTimeMin ?? measurementTimeMin) : 0;

  let measurementEventsPerPiece = 0;
  let variableMeasurementTimeMin = 0;
  let firstPieceMeasurementTimeMin = 0;

  if (input.measurementFrequencyPieces !== undefined && input.measurementFrequencyPieces > 0) {
    measurementEventsPerPiece = 1 / input.measurementFrequencyPieces;
    variableMeasurementTimeMin = measurementEventsPerPiece * measurementTimeMin;
  } else if (input.measurementRequirement === "every_piece") {
    measurementEventsPerPiece = 1;
    variableMeasurementTimeMin = measurementTimeMin;
  } else if (input.measurementRequirement === "sampling") {
    measurementEventsPerPiece = 0.5;
    variableMeasurementTimeMin = measurementTimeMin / 2;
  } else if (input.measurementRequirement === "first_piece") {
    firstPieceMeasurementTimeMin = measurementTimeMin;
  }

  const correctionPassContributionMin = correctionPassTimeMin > 0 ? measurementEventsPerPiece * correctionPassTimeMin : 0;

  return {
    measurementEventsPerPiece,
    variableMeasurementTimeMin,
    firstPieceMeasurementTimeMin,
    correctionPassContributionMin,
  };
}
