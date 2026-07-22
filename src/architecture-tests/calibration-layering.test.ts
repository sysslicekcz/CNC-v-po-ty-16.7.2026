import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { CalculationResult } from "@/domain/calculation-engine/entities/calculation-result";

/**
 * Architektonické testy Fáze G (AP-MCE-001 §30) - stejná technika jako Fáze
 * C/D/E/F `*-strategy-layering.test.ts`/`erp-neutrality.test.ts`.
 */

const SRC_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CALIBRATION_DIR = join(SRC_ROOT, "domain", "calculation-engine", "calibration");
const CALIBRATION_APPLICATION_DIR = join(SRC_ROOT, "application", "calculation-engine", "calibration");
const TPV_DB_FILE = join(SRC_ROOT, "infrastructure", "persistence", "indexeddb", "tpv-db.ts");

function collectTsFiles(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
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

describe("Kalibrace (skutečné časy/odchylky/kalibrace) - architektonické testy (AP-MCE-001 Fáze G §30)", () => {
  const domainFiles = collectTsFiles(CALIBRATION_DIR);

  it("domain/calculation-engine/calibration neimportuje žádný *-repository (Domain nemá přístup k repozitáři)", () => {
    const offenders: string[] = [];
    for (const file of domainFiles) {
      const code = stripComments(readFileSync(file, "utf-8"));
      for (const line of code.match(IMPORT_LINE) ?? []) {
        if (/repositor(y|ies)/i.test(line)) offenders.push(`${file}: ${line.trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("domain/calculation-engine/calibration neimportuje React, Tauri ani infrastructure/indexeddb", () => {
    const offenders: string[] = [];
    for (const file of domainFiles) {
      const code = stripComments(readFileSync(file, "utf-8"));
      for (const line of code.match(IMPORT_LINE) ?? []) {
        if (/^\s*import\s+.*from\s+["'](react|@tauri-apps)/i.test(line) || /infrastructure|indexeddb/i.test(line)) {
          offenders.push(`${file}: ${line.trim()}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("domain/calculation-engine/calibration neimportuje konkrétní technologické strategie (turning/milling/grinding/manual/inspection)", () => {
    const offenders: string[] = [];
    for (const file of domainFiles) {
      const code = stripComments(readFileSync(file, "utf-8"));
      for (const line of code.match(IMPORT_LINE) ?? []) {
        if (/calculation-engine\/(turning|milling|grinding|manual|inspection)\//i.test(line)) offenders.push(`${file}: ${line.trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("domain/calculation-engine/calibration neobsahuje konkrétní ERP názvy (Helios/SAP/K2/Abra) - jen ExternalReferenceSummary.externalSystemId", () => {
    const offenders: string[] = [];
    for (const file of domainFiles) {
      const code = stripComments(readFileSync(file, "utf-8"));
      if (/\b(helios|sap|k2|abra)\b/i.test(code)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });

  it("žádný soubor v domain/calibration nedefinuje pole 'heliosId'/'sapId'/'erpId' (§5/§2 ERP-neutral)", () => {
    const offenders: string[] = [];
    for (const file of domainFiles) {
      const code = stripComments(readFileSync(file, "utf-8"));
      if (/\b(heliosId|sapId|erpId)\b/.test(code)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });

  it("Application vrstva kalibrace (use cases) čte repozitáře jen tam - Domain funkce zůstávají čisté (žádná async metoda mimo use case soubory)", () => {
    const domainAsyncOffenders: string[] = [];
    for (const file of domainFiles) {
      const code = stripComments(readFileSync(file, "utf-8"));
      if (/\basync\s+function\b/.test(code) || /:\s*Promise</.test(code)) domainAsyncOffenders.push(file);
    }
    expect(domainAsyncOffenders).toEqual([]);
  });

  it("CalculationResult nemá žádné settery (architektonická ochrana proti retroaktivní změně starých výsledků, §18 pravidlo 12)", () => {
    const prototype = CalculationResult.prototype as unknown as Record<string, unknown>;
    const descriptors = Object.getOwnPropertyDescriptors(prototype);
    const setterNames = Object.entries(descriptors)
      .filter(([, descriptor]) => typeof descriptor.set === "function")
      .map(([name]) => name);
    expect(setterNames).toEqual([]);
  });

  it("CalibrationProfile.activate()/supersede() vrací NOVOU instanci a nikdy nemutuje 'this' (immutabilita napříč verzemi)", () => {
    const code = stripComments(readFileSync(join(CALIBRATION_DIR, "calibration-profile.ts"), "utf-8"));
    expect(code).toMatch(/activate\([^)]*\):\s*CalibrationProfile\s*\{\s*return new CalibrationProfile/);
    expect(code).toMatch(/supersede\([^)]*\):\s*CalibrationProfile\s*\{\s*return new CalibrationProfile/);
  });

  it("IndexedDB migrace v9 je čistě ADITIVNÍ - 'oldVersion < 9' blok existuje a nepředchází bloku 'oldVersion < 8'", () => {
    const code = readFileSync(TPV_DB_FILE, "utf-8");
    const idxV8 = code.indexOf("oldVersion < 8");
    const idxV9 = code.indexOf("oldVersion < 9");
    expect(idxV8).toBeGreaterThan(-1);
    expect(idxV9).toBeGreaterThan(idxV8);
    expect(code).toMatch(/const DB_VERSION = 9/);
  });

  it("Application vrstva kalibrace (use cases) existuje a neimportuje UI (react/@tauri-apps)", () => {
    const applicationFiles = collectTsFiles(CALIBRATION_APPLICATION_DIR);
    expect(applicationFiles.length).toBeGreaterThan(0);
    const offenders: string[] = [];
    for (const file of applicationFiles) {
      const code = stripComments(readFileSync(file, "utf-8"));
      for (const line of code.match(IMPORT_LINE) ?? []) {
        if (/^\s*import\s+.*from\s+["'](react|@tauri-apps)/i.test(line)) offenders.push(`${file}: ${line.trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
