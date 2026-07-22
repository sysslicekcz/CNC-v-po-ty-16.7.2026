import { describe, it, expect } from "vitest";
import { ActualTimeImportMapping, ActualTimeImportMappingProps, ActualTimeImportRow } from "./actual-time-import";
import { applyImportMapping, runActualTimeImport } from "./actual-time-import-service";
import { validateImportDraft } from "./actual-time-import-validator";

/**
 * Unit testy pro import mechanismus (AP-MCE-001 Fáze G §5, součást 60
 * scénářů §28).
 */

function mapping(overrides: Partial<ActualTimeImportMappingProps> = {}): ActualTimeImportMapping {
  return ActualTimeImportMapping.create({
    id: "mapping:1",
    tenantId: "tenant:acme",
    name: "MES export",
    externalSystemId: "ext-system:1",
    sourceFormat: "csv",
    columnMapping: {
      quantityCompletedColumn: "qty_done",
      quantityPlannedColumn: "qty_plan",
      startedAtColumn: "start",
      finishedAtColumn: "end",
      setupTimeMinColumn: "setup",
    },
    defaultOperationCategory: "turning",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  });
}

function row(rawData: Record<string, string | number | undefined>, rowNumber = 1): ActualTimeImportRow {
  return { rowNumber, rawData };
}

describe("ActualTimeImportMapping (AP-MCE-001 Fáze G §5)", () => {
  it("1. applyImportMapping projektuje surová data podle columnMapping", () => {
    const draft = applyImportMapping(row({ qty_done: 10, qty_plan: 12, start: "2025-01-01T08:00:00.000Z", end: "2025-01-01T09:00:00.000Z", setup: 5 }), mapping());
    expect(draft.quantityCompleted).toBe(10);
    expect(draft.quantityPlanned).toBe(12);
    expect(draft.setupTimeMin).toBe(5);
    expect(draft.operationCategory).toBe("turning");
  });

  it("2. chybějící namapovaný sloupec vrátí undefined, ne výjimku", () => {
    const draft = applyImportMapping(row({ qty_done: 5 }), mapping());
    expect(draft.setupTimeMin).toBeUndefined();
  });
});

describe("validateImportDraft (AP-MCE-001 Fáze G §5)", () => {
  it("3. validní draft neprodukuje blokující chyby", () => {
    const issues = validateImportDraft({ quantityCompleted: 10, productionStartedAt: "2025-01-01T08:00:00.000Z", productionFinishedAt: "2025-01-01T09:00:00.000Z" });
    expect(issues.some((i) => i.severity === "error")).toBe(false);
  });

  it("4. quantityCompleted === 0 vrátí QUANTITY_COMPLETED_ZERO (varování, ne blok)", () => {
    const issues = validateImportDraft({ quantityCompleted: 0 });
    expect(issues.some((i) => i.code === "QUANTITY_COMPLETED_ZERO")).toBe(true);
    expect(issues.some((i) => i.severity === "error")).toBe(false);
  });

  it("5. neplatné (chybějící) quantityCompleted vrátí blokující INVALID_ACTUAL_TIME", () => {
    const issues = validateImportDraft({});
    expect(issues.some((i) => i.code === "INVALID_ACTUAL_TIME" && i.severity === "error")).toBe(true);
  });

  it("6. productionStartedAt po productionFinishedAt vrátí INVALID_TIME_RANGE", () => {
    const issues = validateImportDraft({ quantityCompleted: 1, productionStartedAt: "2025-01-02T00:00:00.000Z", productionFinishedAt: "2025-01-01T00:00:00.000Z" });
    expect(issues.some((i) => i.code === "INVALID_TIME_RANGE")).toBe(true);
  });

  it("7. záporný časový údaj vrátí NEGATIVE_DURATION", () => {
    const issues = validateImportDraft({ quantityCompleted: 1, setupTimeMin: -5 });
    expect(issues.some((i) => i.code === "NEGATIVE_DURATION")).toBe(true);
  });
});

describe("runActualTimeImport (AP-MCE-001 Fáze G §5)", () => {
  it("8. rozdělí řádky na validní/nevalidní a spočítá souhrny", () => {
    const rows = [row({ qty_done: 10 }, 1), row({ qty_done: 5, start: "2025-01-02T00:00:00.000Z", end: "2025-01-01T00:00:00.000Z" }, 2), row({ qty_done: 5 }, 3)];
    const result = runActualTimeImport(rows, mapping());
    expect(result.totalRows).toBe(3);
    expect(result.validRowCount).toBe(2);
    expect(result.invalidRowCount).toBe(1);
    expect(result.rows.find((r) => r.rowNumber === 2)?.status).toBe("invalid");
    expect(result.rows.find((r) => r.rowNumber === 1)?.mappedDraft).toBeDefined();
  });
});
