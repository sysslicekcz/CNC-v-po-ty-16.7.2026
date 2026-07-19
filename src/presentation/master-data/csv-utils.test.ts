import { describe, it, expect } from "vitest";
import { parseCsv, stringifyCsv } from "./csv-utils";

describe("parseCsv", () => {
  it("rozparsuje jednoduché CSV s hlavičkou", () => {
    const rows = parseCsv("code,name\nM-1,Stroj 1\nM-2,Stroj 2");
    expect(rows).toEqual([
      ["code", "name"],
      ["M-1", "Stroj 1"],
      ["M-2", "Stroj 2"],
    ]);
  });

  it("zvládne uvozovkovanou buňku s čárkou uvnitř", () => {
    const rows = parseCsv('code,note\nM-1,"stroj, revidovaný"');
    expect(rows[1]).toEqual(["M-1", "stroj, revidovaný"]);
  });

  it("zvládne escapované uvozovky uvnitř uvozovkované buňky (\"\" -> \")", () => {
    const rows = parseCsv('code,note\nM-1,"rozměr 10""x20"""');
    expect(rows[1][1]).toBe('rozměr 10"x20"');
  });

  it("zvládne nový řádek uvnitř uvozovkované buňky", () => {
    const rows = parseCsv('code,note\nM-1,"řádek 1\nřádek 2"');
    expect(rows[1]).toEqual(["M-1", "řádek 1\nřádek 2"]);
  });

  it("ignoruje osamocený prázdný řádek na konci souboru", () => {
    const rows = parseCsv("code,name\nM-1,Stroj 1\n");
    expect(rows).toHaveLength(2);
  });
});

describe("stringifyCsv - export bezpečný proti CSV/formula injection", () => {
  it("prefixuje buňku začínající '=' apostrofem (Excel/Sheets ji jinak spustí jako vzorec)", () => {
    const csv = stringifyCsv([["note"], ["=cmd|'/c calc'!A1"]]);
    expect(csv).toContain("'=cmd");
  });

  it("prefixuje i '+', '-', '@' na začátku buňky", () => {
    const csv = stringifyCsv([["a", "b", "c"], ["+1", "-1", "@SUM(A1)"]]);
    const [, dataLine] = csv.split("\r\n");
    expect(dataLine).toBe("'+1,'-1,'@SUM(A1)");
  });

  it("neprefixuje běžný text nebo čísla uprostřed hodnoty", () => {
    const csv = stringifyCsv([["code", "name"], ["M-1", "Stroj se sazbou 1000 Kč"]]);
    expect(csv).toContain("M-1,Stroj se sazbou 1000 Kč");
  });

  it("obalí do uvozovek buňku obsahující čárku a escapuje vnitřní uvozovky", () => {
    const csv = stringifyCsv([["note"], ['obsahuje, čárku a "uvozovky"']]);
    expect(csv).toContain('"obsahuje, čárku a ""uvozovky"""');
  });

  it("round-trip: parseCsv(stringifyCsv(rows)) vrátí stejná data", () => {
    const original = [
      ["code", "name", "note"],
      ["M-1", "Stroj, se, čárkami", 'poznámka s "uvozovkami"'],
      ["=DANGEROUS", "Stroj 2", ""],
    ];
    const roundTripped = parseCsv(stringifyCsv(original));
    expect(roundTripped[0]).toEqual(original[0]);
    expect(roundTripped[1]).toEqual(original[1]);
    // Nebezpečný začátek se při exportu sanitizuje (apostrof navíc) - to je
    // ZÁMĚRNÝ rozdíl oproti originálu, ne bug round-tripu.
    expect(roundTripped[2][0]).toBe("'=DANGEROUS");
  });
});
