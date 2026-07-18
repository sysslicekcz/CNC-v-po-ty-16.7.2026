import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { Machine, MachineProps } from "@/domain/entities/machine";
import { Operation } from "@/domain/aggregates/routing-sheet/operation";

/**
 * Statické kontroly architektonické nezávislosti na konkrétním ERP (Krok 3.5
 * dodatek "ERP-nezávislá architektura", bod 14). Helios smí být zmíněný v
 * KOMENTÁŘÍCH jako příklad budoucího konektoru (to je záměrné a časté v
 * tomhle repozitáři), ale nesmí se objevit jako:
 *  - cesta importovaného modulu (`from "...helios..."`),
 *  - jméno exportovaného identifikátoru (typ/interface/třída/konstanta/funkce).
 * Kontrola tedy neprohledává komentáře ani řetězcové literály/chybové zprávy -
 * jen importy a deklarace exportovaných symbolů.
 */

const SRC_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHECKED_LAYERS = ["domain", "application"];

function collectTsFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      collectTsFiles(full, out);
    } else if (entry.endsWith(".ts") && !entry.endsWith(".test.ts") && !entry.endsWith(".test.tsx")) {
      out.push(full);
    }
  }
  return out;
}

function stripComments(source: string): string {
  // Odstraní /* ... */ i // ... komentáře, aby se do nich mohl bezpečně psát
  // "Helios" jako ilustrační příklad, aniž by to spustilo tenhle test.
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

const IMPORT_LINE = /^\s*import\s+.*from\s+["'][^"']+["']/gm;
const EXPORT_DECLARATION = /^\s*export\s+(interface|type|class|const|function|enum)\s+(\w+)/gm;

describe("ERP-nezávislost domain/application vrstev", () => {
  for (const layer of CHECKED_LAYERS) {
    const layerDir = join(SRC_ROOT, layer);
    const files = collectTsFiles(layerDir);

    it(`${layer}: žádný soubor neimportuje modul, jehož cesta obsahuje "helios"`, () => {
      const offenders: string[] = [];
      for (const file of files) {
        const code = stripComments(readFileSync(file, "utf-8"));
        const imports = code.match(IMPORT_LINE) ?? [];
        for (const line of imports) {
          if (/helios/i.test(line)) offenders.push(`${file}: ${line.trim()}`);
        }
      }
      expect(offenders).toEqual([]);
    });

    it(`${layer}: žádný exportovaný typ/třída/konstanta nemá v názvu "Helios"`, () => {
      const offenders: string[] = [];
      for (const file of files) {
        const code = stripComments(readFileSync(file, "utf-8"));
        for (const match of code.matchAll(EXPORT_DECLARATION)) {
          const name = match[2];
          if (/helios/i.test(name)) offenders.push(`${file}: ${name}`);
        }
      }
      expect(offenders).toEqual([]);
    });
  }

  it("Machine neobsahuje heliosId ani žádné jiné ERP-specifické pole - jen interní id a podnikový code", () => {
    const propsKeys: (keyof MachineProps)[] = ["id", "tenantId", "code", "name", "designation", "maxRpm", "hourlyRate", "status", "note", "capacityGroupId"];
    for (const key of propsKeys) {
      expect(key.toLowerCase()).not.toContain("helios");
    }
    expect(Machine.prototype).not.toHaveProperty("heliosId");
  });

  it("Operation neobsahuje heliosMachineCode - vazba na stroj je jen interní machineId", () => {
    expect(Object.getOwnPropertyNames(Operation.prototype)).not.toContain("heliosMachineCode");
    // machineId je jediná vazba na stroj a odkazuje na Machine.id (interní), ne na kód.
    expect(Object.getOwnPropertyDescriptor(Operation.prototype, "machineId")).toBeDefined();
  });
});
