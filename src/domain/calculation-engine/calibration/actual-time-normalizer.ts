import { CalculationIssue } from "../entities/types";
import { calibrationIssue } from "./calibration-issue-codes";
import { ActualTimeRecord } from "./actual-time-record";
import { TimeOverlapResolution } from "./time-overlap-resolver";

export const NORMALIZATION_VERSION = "actual-time-normalization-1.0.0";

export interface NormalizedActualTime {
  actualTimeRecordId: string;
  quantityCompleted: number;
  quantityScrapped: number;
  elapsedTimeMin: number;
  setupTimeMin: number;
  productiveMachineTimeMin: number;
  productiveOperatorTimeMin: number;
  handlingTimeMin: number;
  inspectionTimeMin: number;
  waitingTimeMin: number;
  downtimeMin: number;
  reworkTimeMin: number;
  /** §7 "Při quantityCompleted = 0 nesmí dojít k dělení nulou" -
   *  `undefined`, pokud se nedá spočítat (nula kusů/nula dobrých kusů). */
  goodPieceUnitTimeMin?: number;
  producedPieceUnitTimeMin?: number;
  batchTimeMin: number;
  normalizationVersion: string;
  confidenceScore: number;
  warnings: CalculationIssue[];
}

/**
 * `ActualTimeNormalizer` (AP-MCE-001 Fáze G §7) - ČISTÁ funkce, převádí
 * `ActualTimeRecord` (+ volitelně `TimeOverlapResolution` z jeho segmentů,
 * §4) na společný `NormalizedActualTime` tvar, který dál používá
 * `CalculationVarianceAnalysis` (§8) - JEDNO místo, které rozhoduje "segmenty,
 * nebo ploché souhrnné časy na `ActualTimeRecord` samotném", zbytek modulu
 * čte už jen normalizovaný výstup.
 *
 * `setupTimeMin` se z jednotkových časů VYLUČUJE (§2/§7 "setup čas" je
 * jednorázový, ne po kuse) - `goodPieceUnitTimeMin`/`producedPieceUnitTimeMin`
 * dělí jen (`batchTimeMin - setupTimeMin`) počtem kusů.
 */
export function normalizeActualTime(record: ActualTimeRecord, overlapResolution?: TimeOverlapResolution): NormalizedActualTime {
  const warnings: CalculationIssue[] = [...(overlapResolution?.warnings ?? [])];

  const elapsedTimeMin = overlapResolution?.elapsedTimeMin ?? record.totalElapsedTimeMin ?? 0;
  const setupTimeMin = record.setupTimeMin ?? 0;
  const productiveMachineTimeMin = overlapResolution?.machineOccupiedTimeMin ?? record.machineTimeMin ?? 0;
  const productiveOperatorTimeMin = overlapResolution?.operatorOccupiedTimeMin ?? record.operatorTimeMin ?? 0;
  const handlingTimeMin = record.handlingTimeMin ?? 0;
  const inspectionTimeMin = record.inspectionTimeMin ?? 0;
  const waitingTimeMin = overlapResolution?.waitingTimeMin ?? record.waitingTimeMin ?? 0;
  const downtimeMin = overlapResolution?.downtimeMin ?? record.downtimeMin ?? 0;
  const reworkTimeMin = record.reworkTimeMin ?? 0;

  const batchTimeMin =
    elapsedTimeMin > 0 ? elapsedTimeMin : setupTimeMin + productiveMachineTimeMin + productiveOperatorTimeMin + handlingTimeMin + inspectionTimeMin + waitingTimeMin + downtimeMin + reworkTimeMin;

  let goodPieceUnitTimeMin: number | undefined;
  let producedPieceUnitTimeMin: number | undefined;

  if (record.quantityCompleted > 0) {
    producedPieceUnitTimeMin = Math.max(0, batchTimeMin - setupTimeMin) / record.quantityCompleted;
    const goodPieces = record.quantityCompleted - record.quantityScrapped;
    if (goodPieces > 0) {
      goodPieceUnitTimeMin = Math.max(0, batchTimeMin - setupTimeMin) / goodPieces;
    } else {
      warnings.push(calibrationIssue("NORMALIZATION_FAILED", "Žádný dobrý kus ('quantityCompleted' - 'quantityScrapped' <= 0) - 'goodPieceUnitTimeMin' nelze spočítat.", "goodPieceUnitTimeMin"));
    }
  } else {
    warnings.push(calibrationIssue("QUANTITY_COMPLETED_ZERO", "'quantityCompleted' je nula - jednotkové časy nelze spočítat."));
  }

  const confidenceScore = Math.min(record.confidence, overlapResolution?.confidence ?? 1);

  return {
    actualTimeRecordId: record.id,
    quantityCompleted: record.quantityCompleted,
    quantityScrapped: record.quantityScrapped,
    elapsedTimeMin,
    setupTimeMin,
    productiveMachineTimeMin,
    productiveOperatorTimeMin,
    handlingTimeMin,
    inspectionTimeMin,
    waitingTimeMin,
    downtimeMin,
    reworkTimeMin,
    goodPieceUnitTimeMin,
    producedPieceUnitTimeMin,
    batchTimeMin,
    normalizationVersion: NORMALIZATION_VERSION,
    confidenceScore,
    warnings,
  };
}
