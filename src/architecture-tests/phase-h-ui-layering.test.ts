import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { CALCULATION_FORM_REGISTRY } from "@/presentation/calculations/forms/calculation-form-registry";

/**
 * Architektonické testy Fáze H (AP-MCE-001 §41) - stejná technika jako
 * ostatní `*-layering.test.ts` (čte zdrojové soubory, hledá zakázané
 * importy/vzory), tentokrát zaměřená na presentation vrstvu modulu
 * "Výpočty výroby" (dosud žádná fáze neměla UI, proto vlastní soubor).
 */

const SRC_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CALCULATIONS_DIR = join(SRC_ROOT, "presentation", "calculations");
const APP_CALCULATIONS_DIR = join(SRC_ROOT, "app", "calculations");

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

describe("Modul 'Výpočty výroby' - architektonické testy presentation vrstvy (AP-MCE-001 Fáze H §41)", () => {
  const calculationsFiles = collectTsFiles(CALCULATIONS_DIR);
  const appFiles = collectTsFiles(APP_CALCULATIONS_DIR);
  const allFiles = [...calculationsFiles, ...appFiles];

  it("presentation/calculations neimportuje nic z domain/calculation-engine přímo (jen přes Application DTO výstupy)", () => {
    const offenders: string[] = [];
    for (const file of allFiles) {
      const code = stripComments(readFileSync(file, "utf-8"));
      for (const line of code.match(IMPORT_LINE) ?? []) {
        if (/domain\/calculation-engine/i.test(line)) offenders.push(`${file}: ${line.trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("jen calculation-engine-dependencies.ts a actual-time-import-wizard.tsx smí importovat z @/infrastructure (kompoziční kořen + zdokumentovaná výjimka pro čisté CSV/JSON parsery)", () => {
    const offenders: string[] = [];
    for (const file of allFiles) {
      if (file.endsWith("calculation-engine-dependencies.ts") || file.endsWith("actual-time-import-wizard.tsx")) continue;
      const code = stripComments(readFileSync(file, "utf-8"));
      for (const line of code.match(IMPORT_LINE) ?? []) {
        if (/@\/infrastructure/i.test(line)) offenders.push(`${file}: ${line.trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("CalculationFormRegistry má přesně 6 registrovaných klíčů (turning/milling/grinding_cylindrical/grinding_surface/manual/inspection)", () => {
    expect(Object.keys(CALCULATION_FORM_REGISTRY).sort()).toEqual(["grinding_cylindrical", "grinding_surface", "inspection", "manual", "milling", "turning"]);
  });

  it("schémata formulářů (forms/schemas/*.ts) neexportují žádnou React komponentu - jen deklarativní data", () => {
    const schemaFiles = collectTsFiles(join(CALCULATIONS_DIR, "forms", "schemas"));
    const offenders: string[] = [];
    for (const file of schemaFiles) {
      const code = stripComments(readFileSync(file, "utf-8"));
      if (/export function [A-Z]/.test(code) || /<[a-zA-Z]/.test(code)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });

  it("žádný soubor v presentation/calculations neobsahuje Math.PI/Math.sqrt (žádné technologické vzorce v UI)", () => {
    const offenders: string[] = [];
    for (const file of allFiles) {
      const code = stripComments(readFileSync(file, "utf-8"));
      if (/Math\.PI|Math\.sqrt/.test(code)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });

  it("app/calculations/**/page.tsx jsou tenké route obálky - jen 'use client' + import + jeden návrat JSX komponenty, žádná vlastní logika", () => {
    const offenders: string[] = [];
    for (const file of appFiles) {
      if (!file.endsWith("page.tsx")) continue;
      const code = stripComments(readFileSync(file, "utf-8"));
      const nonEmptyLines = code.split("\n").filter((l) => l.trim().length > 0);
      // Tenká obálka: "use client", import(y), export default function, jeden return - žádný useState/useEffect/fetch.
      if (/useState|useEffect|await /.test(code)) offenders.push(file);
      if (nonEmptyLines.length > 12) offenders.push(`${file} (${nonEmptyLines.length} neprázdných řádků)`);
    }
    expect(offenders).toEqual([]);
  });

  it("žádný soubor v presentation/calculations nezmiňuje 'papaparse'/'xlsx' jako závislost (nedeklarovaná knihovna se nepřidává bez schválení)", () => {
    const offenders: string[] = [];
    for (const file of allFiles) {
      const code = stripComments(readFileSync(file, "utf-8"));
      for (const line of code.match(IMPORT_LINE) ?? []) {
        if (/from\s+["']papaparse["']|from\s+["']xlsx["']/i.test(line)) offenders.push(`${file}: ${line.trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("CalculationSettingsPage nepředstírá CSV/XLSX/PDF export - jen JSON", () => {
    const file = join(CALCULATIONS_DIR, "calculation-settings-page.tsx");
    const code = readFileSync(file, "utf-8");
    expect(code).toMatch(/JSON/);
    expect(code).not.toMatch(/\.csv["'`]|\.xlsx["'`]|\.pdf["'`]/);
  });

  it("OfflineStatusIndicator/LocalOnlyBadge nepředstírají synchronizaci se serverem (žádné 'synchronizováno'/'sync successful' hlášky)", () => {
    const files = [join(CALCULATIONS_DIR, "components", "offline-status-indicator.tsx"), join(CALCULATIONS_DIR, "components", "local-only-badge.tsx")];
    const offenders: string[] = [];
    for (const file of files) {
      const code = readFileSync(file, "utf-8").toLowerCase();
      if (/synchronizováno|sync successful|synced/i.test(code)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });

  it("breakdown-panels.tsx čte 'breakdown' jen jako Record<string, unknown> - žádný import kategorie-specifického doménového typu (turningDetail apod.)", () => {
    const file = join(CALCULATIONS_DIR, "breakdown", "breakdown-panels.tsx");
    const code = stripComments(readFileSync(file, "utf-8"));
    for (const line of code.match(IMPORT_LINE) ?? []) {
      expect(line).not.toMatch(/domain\/calculation-engine/i);
    }
  });

  it("form-input-builders.ts (Application) je JEDINÉ místo mimo domain, které konstruuje TurningFeature/MillingFeature/GrindingFeature literály", () => {
    const files = [
      ...collectTsFiles(join(SRC_ROOT, "application", "calculation-engine")),
      ...calculationsFiles,
    ];
    const offenders: string[] = [];
    for (const file of files) {
      if (file.endsWith("form-input-builders.ts")) continue;
      const code = stripComments(readFileSync(file, "utf-8"));
      if (/as TurningFeature\b|as MillingFeature\b|as GrindingFeature\b/.test(code)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });

  it("calculation-engine-dependencies.ts exportuje jen createCalculationEngineDependencies (funkce) a CalculationEngineDependencies (typ)", () => {
    const file = join(CALCULATIONS_DIR, "calculation-engine-dependencies.ts");
    const code = stripComments(readFileSync(file, "utf-8"));
    const exportedNames = [...code.matchAll(/^export\s+(?:function|type|const)\s+(\w+)/gm)].map((m) => m[1]);
    expect(exportedNames.sort()).toEqual(["CalculationEngineDependencies", "createCalculationEngineDependencies"]);
  });

  it("NewCalculationWizard po úspěšném výpočtu smaže koncept (deleteCalculationDraftUseCase) - autosave nesmí přežít vznik CalculationResult", () => {
    const file = join(CALCULATIONS_DIR, "new-calculation-wizard.tsx");
    const code = readFileSync(file, "utf-8");
    const handleCalculateStart = code.indexOf("async function handleCalculate");
    const handleCalculateBody = code.slice(handleCalculateStart, code.indexOf("\n  async function handleDiscard"));
    expect(handleCalculateBody).toMatch(/deleteCalculationDraftUseCase\.execute/);
  });

  it("Presentation calculations komponenty s 'use client' nikdy neimportují 'server-only' (žádné míchání server/client hranice)", () => {
    const offenders: string[] = [];
    for (const file of calculationsFiles) {
      const code = stripComments(readFileSync(file, "utf-8"));
      if (/"use client"/.test(code) && /from\s+["']server-only["']/.test(code)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });
});
