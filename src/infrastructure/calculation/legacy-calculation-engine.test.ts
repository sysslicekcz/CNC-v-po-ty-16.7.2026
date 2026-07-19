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

/**
 * Ověření transformace vstupních dat pro reprezentativní typy výpočtu (zadání
 * Krok 3, bod 24) - adapter musí vrátit přesně to, co počítá dnešní
 * computeOperation, beze změny vzorců. Výsledek se nikam neukládá, jen
 * porovnává (test, ne migrační krok).
 */
describe("LegacyCalculationEngine - reprezentativní typy výpočtu", () => {
  const cases: { label: string; calculationType: string; rows: Record<string, string | number | null>[] }[] = [
    {
      label: "podélné soustružení",
      calculationType: "podelneVnejsi",
      rows: [{ kontura: "K1", Dc: 40, Df: 20, L: 100, fHrub: 0.3, fDok: 0.1, VcHrub: 180, VcDok: 220, ap: 2 }],
    },
    {
      label: "příčné soustružení",
      calculationType: "pricne",
      rows: [{ kontura: "K1", W: 5, D: 40, d: 20, f: 0.2, Vc: 180, ap: 2 }],
    },
    {
      label: "vrtání",
      calculationType: "vrtani",
      rows: [{ kontura: "K1", pocetDer: 4, D: 8, L: 25, f: 0.15, Vc: 90 }],
    },
    {
      label: "zápich",
      calculationType: "zapich",
      rows: [{ kontura: "K1", D1: 40, D2: 30, W: 5, Fax: 0.1, Vc: 150, Wnuz: 3, Rap: 2 }],
    },
    {
      label: "frézování drážky",
      calculationType: "frezovaniDrazek",
      rows: [{ kontura: "K1", L: 50, W: 8, D: 5, vf: 300, Dc: 8, apMax: 2 }],
    },
    {
      label: "přípravné časy",
      calculationType: "pripravneCasy",
      rows: [{ nazev: "Upnutí", cas: 5, pocet: 1 }],
    },
  ];

  for (const { label, calculationType, rows } of cases) {
    it(`${label} (${calculationType}) - adapter odpovídá computeOperation`, () => {
      const engine = new LegacyCalculationEngine();
      const viaAdapter = engine.compute(calculationType, rows, CURRENT_ALGORITHM_VERSION);
      const viaLegacy = computeOperation(calculationType, rows);
      expect(viaAdapter).toEqual(viaLegacy);
    });
  }
});
