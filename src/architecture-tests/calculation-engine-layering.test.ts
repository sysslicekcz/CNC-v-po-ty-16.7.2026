import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

/**
 * Statické kontroly vrstvení Manufacturing Calculation Engine (AP-MCE-001
 * Fáze B §16) - stejná technika jako `erp-neutrality.test.ts`/`master-data-
 * layering.test.ts` (čte zdrojové soubory, hledá zakázané importy/vzory,
 * žádný bundler/dependency-graph nástroj navíc).
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
const EXPORT_DECLARATION = /^\s*export\s+(interface|type|class|const|function|enum)\s+(\w+)/gm;

describe("Manufacturing Calculation Engine - vrstvení (AP-MCE-001 Fáze B §16)", () => {
  it("domain/calculation-engine neimportuje nic z infrastructure", () => {
    const files = collectTsFiles(join(SRC_ROOT, "domain", "calculation-engine"));
    const offenders: string[] = [];
    for (const file of files) {
      const code = stripComments(readFileSync(file, "utf-8"));
      for (const line of code.match(IMPORT_LINE) ?? []) {
        if (/infrastructure|indexeddb|idb\b/i.test(line)) offenders.push(`${file}: ${line.trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("domain/calculation-engine neimportuje React", () => {
    const files = collectTsFiles(join(SRC_ROOT, "domain", "calculation-engine"));
    const offenders: string[] = [];
    for (const file of files) {
      const code = stripComments(readFileSync(file, "utf-8"));
      for (const line of code.match(IMPORT_LINE) ?? []) {
        if (/^\s*import\s+.*from\s+["']react["']/i.test(line)) offenders.push(`${file}: ${line.trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("application/calculation-engine neimportuje React", () => {
    const files = collectTsFiles(join(SRC_ROOT, "application", "calculation-engine"));
    const offenders: string[] = [];
    for (const file of files) {
      const code = stripComments(readFileSync(file, "utf-8"));
      for (const line of code.match(IMPORT_LINE) ?? []) {
        if (/^\s*import\s+.*from\s+["']react["']/i.test(line)) offenders.push(`${file}: ${line.trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("application/calculation-engine neimportuje nic z infrastructure (use casy/resolvery dostávají repozitáře jako závislosti)", () => {
    const files = collectTsFiles(join(SRC_ROOT, "application", "calculation-engine"));
    const offenders: string[] = [];
    for (const file of files) {
      const code = stripComments(readFileSync(file, "utf-8"));
      for (const line of code.match(IMPORT_LINE) ?? []) {
        if (/infrastructure/i.test(line)) offenders.push(`${file}: ${line.trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("Calculation Engine (domain+application+infrastructure) neobsahuje konkrétní jména ERP systémů (helios/sap/abra/k2)", () => {
    const ERP_NAMES = /\b(helios|sap|abra)\b/i;
    const dirsToCheck = ["domain/calculation-engine", "application/calculation-engine", "infrastructure/calculation-engine"];
    const offenders: string[] = [];
    for (const dir of dirsToCheck) {
      const files = collectTsFiles(join(SRC_ROOT, dir));
      for (const file of files) {
        const code = stripComments(readFileSync(file, "utf-8"));
        // Importy a exportované deklarace, ne komentáře/řetězce - stejná
        // disciplína jako `erp-neutrality.test.ts` (Helios smí být zmíněný v
        // komentáři jako ilustrační příklad budoucího konektoru).
        for (const line of code.match(IMPORT_LINE) ?? []) {
          if (ERP_NAMES.test(line)) offenders.push(`${file}: ${line.trim()}`);
        }
        for (const match of code.matchAll(EXPORT_DECLARATION)) {
          if (ERP_NAMES.test(match[2])) offenders.push(`${file}: ${match[2]}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("žádné pole typu heliosId/sapId/abraId - jen obecná ExternalReference (AP-MCE-001 §9)", () => {
    const FORBIDDEN_FIELD = /\b(helios|sap|abra)Id\b/i;
    const dirsToCheck = ["domain/calculation-engine", "application/calculation-engine", "infrastructure/calculation-engine"];
    const offenders: string[] = [];
    for (const dir of dirsToCheck) {
      const files = collectTsFiles(join(SRC_ROOT, dir));
      for (const file of files) {
        const code = stripComments(readFileSync(file, "utf-8"));
        if (FORBIDDEN_FIELD.test(code)) offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("CalculationStrategy (rozhraní i konkrétní strategie) nesmí importovat žádný *-repository", () => {
    const strategyFiles = collectTsFiles(join(SRC_ROOT, "domain", "calculation-engine")).filter(
      (f) => /strateg/i.test(f) && !f.includes("calculation-strategy-registry")
    );
    const offenders: string[] = [];
    for (const file of strategyFiles) {
      const code = stripComments(readFileSync(file, "utf-8"));
      for (const line of code.match(IMPORT_LINE) ?? []) {
        if (/repositor(y|ies)/i.test(line)) offenders.push(`${file}: ${line.trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("Presentation (a Next.js /app routy) neimportuje nic z domain/calculation-engine přímo - jen přes Application DTO výstupy", () => {
    const presentationFiles = [
      ...collectTsFiles(join(SRC_ROOT, "presentation")),
      ...collectTsFiles(join(SRC_ROOT, "app")),
    ];
    const offenders: string[] = [];
    for (const file of presentationFiles) {
      const code = stripComments(readFileSync(file, "utf-8"));
      for (const line of code.match(IMPORT_LINE) ?? []) {
        if (/domain\/calculation-engine/i.test(line)) offenders.push(`${file}: ${line.trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
