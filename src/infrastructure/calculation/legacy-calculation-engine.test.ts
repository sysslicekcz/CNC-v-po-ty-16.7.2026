import { describe, it, expect } from "vitest";
import { computeOperation } from "@/lib/results";
import { LegacyCalculationEngine } from "./legacy-calculation-engine";
import { CURRENT_ALGORITHM_VERSION } from "@/domain/services/calculation-engine";

const SAMPLE_ROWS = [
  { kontura: "K1", Dc: 40, Df: 20, L: 100, fHrub: 0.3, fDok: 0.1, VcHrub: 180, VcDok: 220, ap: 2 },
  { kontura: "K2", Dc: 20, Df: 20, L: 30, fHrub: 0.3, fDok: 0.1, VcHrub: 180, VcDok: 220, ap: 2 },
];

describe("LegacyCalculationEngine adapter", () => {
  it("vrací přesně stejný výsledek jako původní computeOperation", () => {
    const engine = new LegacyCalculationEngine();
    const viaAdapter = engine.compute("podelneVnejsi", SAMPLE_ROWS, CURRENT_ALGORITHM_VERSION);
    const viaLegacy = computeOperation("podelneVnejsi", SAMPLE_ROWS);
    expect(viaAdapter).toEqual(viaLegacy);
  });

  it("nemění vstupní data", () => {
    const rowsCopy = SAMPLE_ROWS.map((r) => ({ ...r }));
    const engine = new LegacyCalculationEngine();
    engine.compute("podelneVnejsi", rowsCopy, CURRENT_ALGORITHM_VERSION);
    expect(rowsCopy).toEqual(SAMPLE_ROWS);
  });

  it("funguje pro neznámý calculationType stejně jako computeOperation (prázdný výsledek)", () => {
    const engine = new LegacyCalculationEngine();
    const viaAdapter = engine.compute("neexistujici-typ", [], CURRENT_ALGORITHM_VERSION);
    const viaLegacy = computeOperation("neexistujici-typ", []);
    expect(viaAdapter).toEqual(viaLegacy);
    expect(viaAdapter).toEqual({ rows: [], total: 0 });
  });
});
