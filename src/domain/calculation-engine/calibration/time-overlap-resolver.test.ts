import { describe, it, expect } from "vitest";
import { ActualTimeSegment, ActualTimeSegmentProps } from "./actual-time-segment";
import { resolveTimeOverlaps } from "./time-overlap-resolver";

/**
 * Unit testy pro `TimeOverlapResolver` (AP-MCE-001 Fáze G §4, součást 60
 * scénářů §28).
 */

function segment(overrides: Partial<ActualTimeSegmentProps> = {}): ActualTimeSegment {
  return ActualTimeSegment.create({
    id: overrides.id ?? "seg:1",
    actualTimeRecordId: "atr:1",
    segmentType: "production",
    startedAt: "2025-01-01T08:00:00.000Z",
    finishedAt: "2025-01-01T09:00:00.000Z",
    durationMin: 60,
    source: "manual",
    sourceEventIds: [],
    overlapsAllowed: false,
    ...overrides,
  });
}

describe("resolveTimeOverlaps (AP-MCE-001 Fáze G §4)", () => {
  it("1. bez segmentů vrátí nulové časy s plnou confidence", () => {
    const result = resolveTimeOverlaps([]);
    expect(result.elapsedTimeMin).toBe(0);
    expect(result.confidence).toBe(1);
  });

  it("2. dva NEpřekrývající se segmenty se sečtou", () => {
    const s1 = segment({ id: "s1", startedAt: "2025-01-01T08:00:00.000Z", finishedAt: "2025-01-01T09:00:00.000Z" });
    const s2 = segment({ id: "s2", startedAt: "2025-01-01T09:00:00.000Z", finishedAt: "2025-01-01T10:00:00.000Z" });
    const result = resolveTimeOverlaps([s1, s2]);
    expect(result.elapsedTimeMin).toBeCloseTo(120, 9);
    expect(result.overlapTimeMin).toBe(0);
  });

  it("3. dva překrývající se segmenty stejného typu se NEpočítají dvakrát (union, ne součet)", () => {
    const s1 = segment({ id: "s1", startedAt: "2025-01-01T08:00:00.000Z", finishedAt: "2025-01-01T09:00:00.000Z" });
    const s2 = segment({ id: "s2", startedAt: "2025-01-01T08:30:00.000Z", finishedAt: "2025-01-01T09:30:00.000Z" });
    const result = resolveTimeOverlaps([s1, s2]);
    // union 08:00-09:30 = 90 min, ne 120 min (prostý součet)
    expect(result.elapsedTimeMin).toBeCloseTo(90, 9);
    expect(result.overlapTimeMin).toBeCloseTo(30, 9);
    expect(result.unresolvedOverlapMin).toBeCloseTo(30, 9);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("4. machine_cycle + operator_attendance překryv je VŽDY povolený (bez varování)", () => {
    const s1 = segment({ id: "s1", segmentType: "machine_cycle", startedAt: "2025-01-01T08:00:00.000Z", finishedAt: "2025-01-01T09:00:00.000Z" });
    const s2 = segment({ id: "s2", segmentType: "operator_attendance", startedAt: "2025-01-01T08:30:00.000Z", finishedAt: "2025-01-01T09:30:00.000Z" });
    const result = resolveTimeOverlaps([s1, s2]);
    expect(result.unresolvedOverlapMin).toBe(0);
    expect(result.warnings).toHaveLength(0);
  });

  it("5. waiting/downtime segmenty se NEpočítají jako produktivní čas", () => {
    const production = segment({ id: "s1", segmentType: "production", startedAt: "2025-01-01T08:00:00.000Z", finishedAt: "2025-01-01T09:00:00.000Z" });
    const waiting = segment({ id: "s2", segmentType: "waiting", startedAt: "2025-01-01T09:00:00.000Z", finishedAt: "2025-01-01T09:30:00.000Z" });
    const result = resolveTimeOverlaps([production, waiting]);
    expect(result.productiveTimeMin).toBeCloseTo(60, 9);
    expect(result.nonProductiveTimeMin).toBeCloseTo(30, 9);
    expect(result.waitingTimeMin).toBeCloseTo(30, 9);
  });

  it("6. segment typu 'unknown' sníží confidence", () => {
    const known = segment({ id: "s1" });
    const unknown = segment({ id: "s2", segmentType: "unknown", startedAt: "2025-01-01T10:00:00.000Z", finishedAt: "2025-01-01T10:30:00.000Z" });
    const withUnknown = resolveTimeOverlaps([known, unknown]);
    const withoutUnknown = resolveTimeOverlaps([known]);
    expect(withUnknown.confidence).toBeLessThan(withoutUnknown.confidence);
  });

  it("7. překrývající se segmenty stejného zaměstnance vygenerují OVERLAPPING_EMPLOYEE_SEGMENTS", () => {
    const s1 = segment({ id: "s1", segmentType: "handling", employeeId: "emp:1", startedAt: "2025-01-01T08:00:00.000Z", finishedAt: "2025-01-01T09:00:00.000Z" });
    const s2 = segment({ id: "s2", segmentType: "cleaning", employeeId: "emp:1", startedAt: "2025-01-01T08:30:00.000Z", finishedAt: "2025-01-01T09:30:00.000Z" });
    const result = resolveTimeOverlaps([s1, s2]);
    expect(result.warnings.some((w) => w.code === "OVERLAPPING_EMPLOYEE_SEGMENTS")).toBe(true);
  });

  it("8. explicitně povolený překryv ('overlapsAllowed' na obou) nevygeneruje varování", () => {
    const s1 = segment({ id: "s1", overlapsAllowed: true, startedAt: "2025-01-01T08:00:00.000Z", finishedAt: "2025-01-01T09:00:00.000Z" });
    const s2 = segment({ id: "s2", segmentType: "inspection", overlapsAllowed: true, startedAt: "2025-01-01T08:30:00.000Z", finishedAt: "2025-01-01T09:30:00.000Z" });
    const result = resolveTimeOverlaps([s1, s2]);
    expect(result.warnings).toHaveLength(0);
    expect(result.unresolvedOverlapMin).toBe(0);
  });
});
