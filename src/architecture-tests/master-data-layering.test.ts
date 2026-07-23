import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

/**
 * Statické kontroly vrstvení kmenových dat (Krok 5, zadání sekce 61-73 -
 * "architektonické testy"). Stejná technika jako `erp-neutrality.test.ts`
 * (Krok 3.5) - čte zdrojové soubory a hledá zakázané importy, žádný
 * bundler/dependency-graph nástroj navíc.
 */

const SRC_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function collectTsFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      collectTsFiles(full, out);
    } else if ((entry.endsWith(".ts") || entry.endsWith(".tsx")) && !entry.endsWith(".test.ts") && !entry.endsWith(".test.tsx")) {
      out.push(full);
    }
  }
  return out;
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

const IMPORT_LINE = /^\s*import\s+.*from\s+["'][^"']+["']/gm;

describe("Vrstvení kmenových dat (Krok 5)", () => {
  it("domain vrstva neimportuje nic z infrastructure (žádný přímý IndexedDB/Dexie kontakt)", () => {
    const domainFiles = collectTsFiles(join(SRC_ROOT, "domain"));
    const offenders: string[] = [];
    for (const file of domainFiles) {
      const code = stripComments(readFileSync(file, "utf-8"));
      for (const line of code.match(IMPORT_LINE) ?? []) {
        if (/infrastructure|indexeddb|idb\b/i.test(line)) offenders.push(`${file}: ${line.trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("application vrstva neimportuje nic z infrastructure (use casy dostávají repozitáře jako závislosti, nevytváří si je)", () => {
    const applicationFiles = collectTsFiles(join(SRC_ROOT, "application"));
    const offenders: string[] = [];
    for (const file of applicationFiles) {
      const code = stripComments(readFileSync(file, "utf-8"));
      for (const line of code.match(IMPORT_LINE) ?? []) {
        if (/infrastructure/i.test(line)) offenders.push(`${file}: ${line.trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("stránky /tpv/master-data/* NEIMPORTUJÍ IndexedDb*Repository přímo - jen přes master-data-dependencies.ts", () => {
    const pageFiles = collectTsFiles(join(SRC_ROOT, "app", "tpv", "master-data"));
    const offenders: string[] = [];
    for (const file of pageFiles) {
      const code = stripComments(readFileSync(file, "utf-8"));
      for (const line of code.match(IMPORT_LINE) ?? []) {
        if (/infrastructure\/persistence\/indexeddb\/repositories/i.test(line)) offenders.push(`${file}: ${line.trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("presentation/master-data komponenty (mimo master-data-dependencies.ts samotný) NEIMPORTUJÍ IndexedDb*Repository přímo", () => {
    const presentationFiles = collectTsFiles(join(SRC_ROOT, "presentation", "master-data")).filter(
      (f) => !f.endsWith("master-data-dependencies.ts")
    );
    const offenders: string[] = [];
    for (const file of presentationFiles) {
      const code = stripComments(readFileSync(file, "utf-8"));
      for (const line of code.match(IMPORT_LINE) ?? []) {
        if (/infrastructure\/persistence\/indexeddb\/repositories/i.test(line)) offenders.push(`${file}: ${line.trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("master-data-dependencies.ts/routing-sheet-editor-dependencies.ts/integration-dependencies.ts/calculation-engine-dependencies.ts jsou JEDINÁ místa v presentation vrstvě, která smí instanciovat IndexedDb*Repository (kontrolní součet)", () => {
    const presentationFiles = collectTsFiles(join(SRC_ROOT, "presentation"));
    const filesInstantiatingIndexedDbRepo = presentationFiles.filter((f) => {
      const code = stripComments(readFileSync(f, "utf-8"));
      return /new IndexedDb\w*Repository\(/.test(code);
    });
    const allowList = filesInstantiatingIndexedDbRepo.filter(
      (f) =>
        f.endsWith("master-data-dependencies.ts") ||
        f.endsWith("routing-sheet-editor-dependencies.ts") ||
        f.endsWith("integration-dependencies.ts") ||
        // Fáze H - stejný "žádný DI kontejner" vzor pro modul "Výpočty výroby".
        f.endsWith("calculation-engine-dependencies.ts")
    );
    expect(filesInstantiatingIndexedDbRepo.sort()).toEqual(allowList.sort());
  });
});
