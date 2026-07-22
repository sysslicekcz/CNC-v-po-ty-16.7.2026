import { describe, it, expect } from "vitest";
import { ActualTimeRecord, ActualTimeRecordProps } from "./actual-time-record";
import { ActualTimeSegment, ActualTimeSegmentProps } from "./actual-time-segment";
import { ValidationError } from "@/domain/errors/validation-error";

/**
 * Unit testy pro `ActualTimeRecord`/`ActualTimeSegment` (AP-MCE-001 Fáze G
 * §2/§3, součást 60 scénářů §28).
 */

const NOW = "2025-01-01T00:00:00.000Z";
const TENANT_ID = "tenant:acme";

function baseProps(overrides: Partial<ActualTimeRecordProps> = {}): ActualTimeRecordProps {
  return {
    id: "atr:1",
    tenantId: TENANT_ID,
    externalReferences: [],
    operationCategory: "turning",
    quantityPlanned: 10,
    quantityCompleted: 10,
    quantityScrapped: 0,
    sourceType: "manual",
    sourceSystem: "internal",
    measurementMethod: "explicit_duration",
    confidence: 0.8,
    status: "draft",
    recordedBy: "user:1",
    recordedAt: NOW,
    recordVersion: 1,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function baseSegmentProps(overrides: Partial<ActualTimeSegmentProps> = {}): ActualTimeSegmentProps {
  return {
    id: "seg:1",
    actualTimeRecordId: "atr:1",
    segmentType: "production",
    startedAt: "2025-01-01T08:00:00.000Z",
    finishedAt: "2025-01-01T09:00:00.000Z",
    durationMin: 60,
    source: "manual",
    sourceEventIds: [],
    overlapsAllowed: false,
    ...overrides,
  };
}

describe("ActualTimeRecord (AP-MCE-001 Fáze G §2)", () => {
  it("1. validní vstup se vytvoří bez chyb", () => {
    expect(() => ActualTimeRecord.create(baseProps())).not.toThrow();
  });

  it("2. záporné 'setupTimeMin' vyhodí ValidationError", () => {
    expect(() => ActualTimeRecord.create(baseProps({ setupTimeMin: -1 }))).toThrow(ValidationError);
  });

  it("3. 'confidence' mimo 0..1 vyhodí ValidationError", () => {
    expect(() => ActualTimeRecord.create(baseProps({ confidence: 1.5 }))).toThrow(ValidationError);
  });

  it("4. 'setupStartedAt' po 'setupFinishedAt' vyhodí ValidationError", () => {
    expect(() =>
      ActualTimeRecord.create(baseProps({ setupStartedAt: "2025-01-02T00:00:00.000Z", setupFinishedAt: "2025-01-01T00:00:00.000Z" }))
    ).toThrow(ValidationError);
  });

  it("5. 'withApproval'/'withStatus'/'withMatch'/'archive' vrací novou instanci a zvyšují recordVersion", () => {
    const record = ActualTimeRecord.create(baseProps());
    const approved = record.withApproval("user:2", NOW);
    expect(approved).not.toBe(record);
    expect(approved.status).toBe("approved");
    expect(approved.recordVersion).toBe(2);
    expect(record.status).toBe("draft");

    const matched = record.withMatch("calc:1", 3, NOW);
    expect(matched.calculationId).toBe("calc:1");
    expect(matched.calculationRevision).toBe(3);

    const archived = record.archive(NOW);
    expect(archived.isArchived).toBe(true);
    expect(archived.status).toBe("archived");
    // druhé zavolání archive na už archivovaném záznamu je no-op (stejná instance)
    expect(archived.archive("2025-06-01T00:00:00.000Z")).toBe(archived);
  });
});

describe("ActualTimeSegment (AP-MCE-001 Fáze G §3)", () => {
  it("6. validní segment se vytvoří bez chyb", () => {
    expect(() => ActualTimeSegment.create(baseSegmentProps())).not.toThrow();
  });

  it("7. 'startedAt' po 'finishedAt' vyhodí ValidationError", () => {
    expect(() => ActualTimeSegment.create(baseSegmentProps({ startedAt: "2025-01-01T10:00:00.000Z", finishedAt: "2025-01-01T09:00:00.000Z" }))).toThrow(ValidationError);
  });

  it("8. záporné 'durationMin' vyhodí ValidationError", () => {
    expect(() => ActualTimeSegment.create(baseSegmentProps({ durationMin: -5 }))).toThrow(ValidationError);
  });
});
