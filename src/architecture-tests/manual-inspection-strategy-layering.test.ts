import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { ManualOperationCalculationStrategy } from "@/domain/calculation-engine/manual/manual-operation-calculation-strategy";
import { InspectionCalculationStrategy } from "@/domain/calculation-engine/inspection/inspection-calculation-strategy";
import { TurningCalculationStrategy } from "@/domain/calculation-engine/turning/turning-calculation-strategy";
import { MillingCalculationStrategy } from "@/domain/calculation-engine/milling/milling-calculation-strategy";
import { GrindingCalculationStrategy } from "@/domain/calculation-engine/grinding/grinding-calculation-strategy";
import { DefaultCalculationEngine } from "@/domain/calculation-engine/services/calculation-engine";
import { InMemoryCalculationStrategyRegistry } from "@/domain/calculation-engine/services/calculation-strategy-registry";

/**
 * Architektonické testy Fáze F (AP-MCE-001 §23) - stejná technika jako Fáze
 * C/D/E `*-strategy-layering.test.ts`.
 */

const SRC_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MANUAL_DIR = join(SRC_ROOT, "domain", "calculation-engine", "manual");
const INSPECTION_DIR = join(SRC_ROOT, "domain", "calculation-engine", "inspection");
const TURNING_STRATEGY_FILE = join(SRC_ROOT, "domain", "calculation-engine", "turning", "turning-calculation-strategy.ts");
const MILLING_STRATEGY_FILE = join(SRC_ROOT, "domain", "calculation-engine", "milling", "milling-calculation-strategy.ts");
const GRINDING_DIR = join(SRC_ROOT, "domain", "calculation-engine", "grinding");

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

describe("Manual/Inspection strategie - architektonické testy (AP-MCE-001 Fáze F §23)", () => {
  const manualFiles = collectTsFiles(MANUAL_DIR);
  const inspectionFiles = collectTsFiles(INSPECTION_DIR);
  const allFazeFFiles = [...manualFiles, ...inspectionFiles];

  it("domain/calculation-engine/manual a /inspection neimportují žádný *-repository (strategie nemá přístup k repozitáři)", () => {
    const offenders: string[] = [];
    for (const file of allFazeFFiles) {
      const code = stripComments(readFileSync(file, "utf-8"));
      for (const line of code.match(IMPORT_LINE) ?? []) {
        if (/repositor(y|ies)/i.test(line)) offenders.push(`${file}: ${line.trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("domain/calculation-engine/manual a /inspection neimportují React, Tauri ani infrastructure", () => {
    const offenders: string[] = [];
    for (const file of allFazeFFiles) {
      const code = stripComments(readFileSync(file, "utf-8"));
      for (const line of code.match(IMPORT_LINE) ?? []) {
        if (/^\s*import\s+.*from\s+["'](react|@tauri-apps)/i.test(line) || /infrastructure|indexeddb/i.test(line)) {
          offenders.push(`${file}: ${line.trim()}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("domain/calculation-engine/manual a /inspection neimportují turning/milling/grinding (technologické moduly jsou nezávislé)", () => {
    const offenders: string[] = [];
    for (const file of allFazeFFiles) {
      const code = stripComments(readFileSync(file, "utf-8"));
      for (const line of code.match(IMPORT_LINE) ?? []) {
        if (/calculation-engine\/(turning|milling|grinding)/i.test(line)) offenders.push(`${file}: ${line.trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("Manual/Inspection strategie jsou čisté - žádná metoda instance nevrací Promise", () => {
    for (const strategy of [new ManualOperationCalculationStrategy(), new InspectionCalculationStrategy()]) {
      expect(strategy.calculate.constructor.name).not.toBe("AsyncFunction");
      expect(strategy.validate.constructor.name).not.toBe("AsyncFunction");
    }
  });

  it("UI (presentation/app) a Planning Engine neobsahují ruční ani kontrolní vzorce - žádný soubor mimo domain/application neimportuje domain/calculation-engine/manual nebo /inspection", () => {
    const outsideFiles = [
      ...collectTsFiles(join(SRC_ROOT, "presentation")),
      ...collectTsFiles(join(SRC_ROOT, "app")),
      ...collectTsFiles(join(SRC_ROOT, "planning")),
    ];
    const offenders: string[] = [];
    for (const file of outsideFiles) {
      const code = stripComments(readFileSync(file, "utf-8"));
      for (const line of code.match(IMPORT_LINE) ?? []) {
        if (/calculation-engine\/(manual|inspection)/i.test(line)) offenders.push(`${file}: ${line.trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("Calculation Engine (manual/inspection) neobsahuje konkrétní ERP názvy (Helios/SAP/K2/...)", () => {
    const offenders: string[] = [];
    for (const file of allFazeFFiles) {
      const code = stripComments(readFileSync(file, "utf-8"));
      if (/\b(helios|sap|k2|abra)\b/i.test(code)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });

  it("registry zůstává rozšiřitelný - žádné 'if (category === \"manual\"/\"inspection\")' větvení, jen Map.get/set", () => {
    const registryFile = join(SRC_ROOT, "domain", "calculation-engine", "services", "calculation-strategy-registry.ts");
    const engineFile = join(SRC_ROOT, "domain", "calculation-engine", "services", "calculation-engine.ts");
    for (const file of [registryFile, engineFile]) {
      const code = stripComments(readFileSync(file, "utf-8"));
      expect(code).not.toMatch(/["']manual["']/);
      expect(code).not.toMatch(/["']inspection["']/);
    }
  });

  it("dřívější strategie (Turning/Milling/Grinding) nebyly kvůli Fázi F přepsány - neobsahují 'manual'/'inspection'", () => {
    const code = stripComments(readFileSync(TURNING_STRATEGY_FILE, "utf-8")) + stripComments(readFileSync(MILLING_STRATEGY_FILE, "utf-8"));
    expect(code).not.toMatch(/\bmanual\b/i);
    expect(code).not.toMatch(/\binspection\b/i);
    expect(new TurningCalculationStrategy().strategyVersion).toBe("turning-1.0.0");
    expect(new MillingCalculationStrategy().strategyVersion).toBe("milling-1.0.0");

    const grindingFiles = collectTsFiles(GRINDING_DIR);
    for (const file of grindingFiles) {
      const grindingCode = stripComments(readFileSync(file, "utf-8"));
      expect(grindingCode).not.toMatch(/\bmanual\b/i);
      expect(grindingCode).not.toMatch(/\binspection\b/i);
    }
    expect(new GrindingCalculationStrategy().operationCategory).toBe("grinding");
  });

  it("nové výsledky používají algorithmVersion 'mce-v1' a strategyVersion odpovídá příslušné strategii", () => {
    const registry = new InMemoryCalculationStrategyRegistry();
    const manual = new ManualOperationCalculationStrategy();
    const inspection = new InspectionCalculationStrategy();
    registry.register(manual);
    registry.register(inspection);
    const engine = new DefaultCalculationEngine(registry);

    expect(engine.engineVersion).toBe("mce-v1");
    expect(manual.operationCategory).toBe("manual");
    expect(manual.strategyVersion).toBe("manual-operation-1.0.0");
    expect(inspection.operationCategory).toBe("inspection");
    expect(inspection.strategyVersion).toBe("inspection-1.0.0");
  });

  it("přidání Manual/Inspection strategií nevyžadovalo změnu registru/enginu mimo jedno volání register(...)", () => {
    const factoryFile = join(SRC_ROOT, "infrastructure", "calculation-engine", "calculation-strategy-registry-factory.ts");
    const code = readFileSync(factoryFile, "utf-8");
    expect(code).toMatch(/new ManualOperationCalculationStrategy\(\)/);
    expect(code).toMatch(/new InspectionCalculationStrategy\(\)/);
    expect(code).toMatch(/new TurningCalculationStrategy\(\)/);
    expect(code).toMatch(/new MillingCalculationStrategy\(\)/);
    expect(code).toMatch(/new GrindingCalculationStrategy\(\)/);
  });

  it("starý LegacyCalculationEngine (domain/services/calculation-engine.ts) zůstává dostupný jako fallback", () => {
    expect(existsSync(join(SRC_ROOT, "domain", "services", "calculation-engine.ts"))).toBe(true);
  });
});
