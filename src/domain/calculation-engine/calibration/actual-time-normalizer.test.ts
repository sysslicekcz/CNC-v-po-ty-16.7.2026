import { describe, it, expect } from "vitest";
import { ActualTimeRecord, ActualTimeRecordProps } from "./actual-time-record";
import { normalizeActualTime } from "./actual-time-normalizer";
import { TimeOverlapResolution } from "./time-overlap-resolver";

/**
 * Unit testy pro `ActualTimeNormalizer` (AP-MCE-001 Fáze G §7, součást 60
 * scénářů §28).
 */

const NOW = "2025-01-01T00:00:00.000Z";

function record(overrides: Partial<ActualTimeRecordProps> = {}): ActualTimeRecord {
  return ActualTimeRecord.create({
    id: "atr:1",
    tenantId: "tenant:acme",
    externalReferences: [],
    operationCategory: "turning",
    quantityPlanned: 10,
    quantityCompleted: 10,
    quantityScrapped: 0,
    sourceType: "manual",
    sourceSystem: "internal",
    measurementMethod: "explicit_duration",
    confidence: 0.9,
    status: "draft",
    recordedBy: "user:1",
    recordedAt: NOW,
    recordVersion: 1,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  });
}

describe("normalizeActualTime (AP-MCE-001 Fáze G §7)", () => {
  it("1. bez segmentů použije ploché souhrnné časy na ActualTimeRecord", () => {
    const rec = record({ totalElapsedTimeMin: 100, setupTimeMin: 10, machineTimeMin: 60, operatorTimeMin: 30 });
    const result = normalizeActualTime(rec);
    expect(result.elapsedTimeMin).toBe(100);
    expect(result.setupTimeMin).toBe(10);
    expect(result.productiveMachineTimeMin).toBe(60);
  });

  it("2. 'goodPieceUnitTimeMin'/'producedPieceUnitTimeMin' vyloučí setupTimeMin a dělí počtem kusů", () => {
    const rec = record({ totalElapsedTimeMin: 110, setupTimeMin: 10, quantityCompleted: 10, quantityScrapped: 0 });
    const result = normalizeActualTime(rec);
    expect(result.producedPieceUnitTimeMin).toBeCloseTo(10, 9);
    expect(result.goodPieceUnitTimeMin).toBeCloseTo(10, 9);
  });

  it("3. quantityCompleted === 0 nesmí dělit nulou - vrátí undefined jednotkové časy + warning", () => {
    const rec = record({ totalElapsedTimeMin: 100, quantityCompleted: 0 });
    const result = normalizeActualTime(rec);
    expect(result.goodPieceUnitTimeMin).toBeUndefined();
    expect(result.producedPieceUnitTimeMin).toBeUndefined();
    expect(result.warnings.some((w) => w.code === "QUANTITY_COMPLETED_ZERO")).toBe(true);
  });

  it("4. quantityScrapped === quantityCompleted (žádný dobrý kus) vrátí NORMALIZATION_FAILED pro goodPieceUnitTimeMin", () => {
    const rec = record({ totalElapsedTimeMin: 100, quantityCompleted: 5, quantityScrapped: 5 });
    const result = normalizeActualTime(rec);
    expect(result.goodPieceUnitTimeMin).toBeUndefined();
    expect(result.producedPieceUnitTimeMin).toBeDefined();
    expect(result.warnings.some((w) => w.code === "NORMALIZATION_FAILED")).toBe(true);
  });

  it("5. confidenceScore je MIN(record.confidence, overlapResolution.confidence)", () => {
    const rec = record({ confidence: 0.9 });
    const overlap: TimeOverlapResolution = {
      elapsedTimeMin: 60,
      machineOccupiedTimeMin: 60,
      operatorOccupiedTimeMin: 0,
      productiveTimeMin: 60,
      nonProductiveTimeMin: 0,
      waitingTimeMin: 0,
      downtimeMin: 0,
      overlapTimeMin: 0,
      unresolvedOverlapMin: 0,
      confidence: 0.4,
      warnings: [],
    };
    const result = normalizeActualTime(rec, overlap);
    expect(result.confidenceScore).toBeCloseTo(0.4, 9);
    expect(result.elapsedTimeMin).toBe(60);
  });
});
