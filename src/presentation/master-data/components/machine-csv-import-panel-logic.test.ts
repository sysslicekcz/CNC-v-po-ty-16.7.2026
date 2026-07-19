import { describe, it, expect } from "vitest";
import { buildPreview, MACHINE_CSV_HEADERS } from "./machine-csv-import-panel";

/** UI logika CSV importu strojů (Krok 5, zadání sekce 61-73 - "UI logika") -
 *  čistá funkce vytažená z `MachineCsvImportPanel`, testovaná bez React
 *  rendereru (stejný vzor jako `feature-gate-logic.test.ts`). */
describe("buildPreview (CSV import strojů)", () => {
  it("řádek s vyplněným 'code' i 'name' je platný", () => {
    const preview = buildPreview(MACHINE_CSV_HEADERS, [["M-1", "Stroj 1", "", "", "", "", "", "", "1000", "CZK", ""]]);
    expect(preview[0].valid).toBe(true);
    expect(preview[0].raw.code).toBe("M-1");
  });

  it("řádek bez 'code' je neplatný s vysvětlující chybou", () => {
    const preview = buildPreview(["code", "name"], [["", "Stroj bez kódu"]]);
    expect(preview[0].valid).toBe(false);
    expect(preview[0].error).toMatch(/code/);
  });

  it("řádek bez 'name' je neplatný", () => {
    const preview = buildPreview(["code", "name"], [["M-1", ""]]);
    expect(preview[0].valid).toBe(false);
    expect(preview[0].error).toMatch(/name/);
  });

  it("nečíselné 'hourlyRateAmount' je neplatné", () => {
    const preview = buildPreview(["code", "name", "hourlyRateAmount"], [["M-1", "Stroj 1", "hodně"]]);
    expect(preview[0].valid).toBe(false);
    expect(preview[0].error).toMatch(/hourlyRateAmount/);
  });

  it("prázdné 'hourlyRateAmount' NENÍ chyba (nepovinné pole, doplní se výchozí 0 v use case)", () => {
    const preview = buildPreview(["code", "name", "hourlyRateAmount"], [["M-1", "Stroj 1", ""]]);
    expect(preview[0].valid).toBe(true);
  });

  it("pořadí sloupců v hlavičce se nevynucuje - hledá se podle názvu", () => {
    const preview = buildPreview(["name", "code"], [["Stroj 1", "M-1"]]);
    expect(preview[0].raw.code).toBe("M-1");
    expect(preview[0].raw.name).toBe("Stroj 1");
  });

  it("chybějící sloupec v hlavičce se bere jako prázdný řetězec, ne jako pád", () => {
    const preview = buildPreview(["code", "name"], [["M-1", "Stroj 1"]]);
    expect(preview[0].raw.manufacturer).toBe("");
  });

  it("víc řádků se validuje nezávisle na sobě", () => {
    const preview = buildPreview(
      ["code", "name"],
      [
        ["M-1", "Stroj 1"],
        ["", "Chybí kód"],
        ["M-3", "Stroj 3"],
      ]
    );
    expect(preview.map((r) => r.valid)).toEqual([true, false, true]);
  });
});
