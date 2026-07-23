import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { MillingCalculationStrategy } from "@/domain/calculation-engine/milling/milling-calculation-strategy";
import { TurningCalculationStrategy } from "@/domain/calculation-engine/turning/turning-calculation-strategy";
import { DefaultCalculationEngine } from "@/domain/calculation-engine/services/calculation-engine";
import { InMemoryCalculationStrategyRegistry } from "@/domain/calculation-engine/services/calculation-strategy-registry";

/**
 * Architektonické testy Fáze D (AP-MCE-001 §21) - stejná technika jako Fáze C
 * `turning-strategy-layering.test.ts` (čte zdrojové soubory, hledá zakázané
 * importy/vzory).
 */

const SRC_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MILLING_DIR = join(SRC_ROOT, "domain", "calculation-engine", "milling");
const TURNING_STRATEGY_FILE = join(SRC_ROOT, "domain", "calculation-engine", "turning", "turning-calculation-strategy.ts");

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

describe("MillingCalculationStrategy - architektonické testy (AP-MCE-001 Fáze D §21)", () => {
  const millingFiles = collectTsFiles(MILLING_DIR);

  it("domain/calculation-engine/milling neimportuje žádný *-repository (strategie nemá přístup k repozitáři)", () => {
    const offenders: string[] = [];
    for (const file of millingFiles) {
      const code = stripComments(readFileSync(file, "utf-8"));
      for (const line of code.match(IMPORT_LINE) ?? []) {
        if (/repositor(y|ies)/i.test(line)) offenders.push(`${file}: ${line.trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("domain/calculation-engine/milling neimportuje React, Tauri ani infrastructure", () => {
    const offenders: string[] = [];
    for (const file of millingFiles) {
      const code = stripComments(readFileSync(file, "utf-8"));
      for (const line of code.match(IMPORT_LINE) ?? []) {
        if (/^\s*import\s+.*from\s+["'](react|@tauri-apps)/i.test(line) || /infrastructure|indexeddb/i.test(line)) {
          offenders.push(`${file}: ${line.trim()}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("domain/calculation-engine/milling neimportuje domain/calculation-engine/turning (technologické moduly jsou nezávislé)", () => {
    const offenders: string[] = [];
    for (const file of millingFiles) {
      const code = stripComments(readFileSync(file, "utf-8"));
      for (const line of code.match(IMPORT_LINE) ?? []) {
        if (/calculation-engine\/turning/i.test(line)) offenders.push(`${file}: ${line.trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("MillingCalculationStrategy je čistá - žádná metoda instance nevrací Promise", () => {
    const strategy = new MillingCalculationStrategy();
    expect(strategy.calculate.constructor.name).not.toBe("AsyncFunction");
    expect(strategy.validate.constructor.name).not.toBe("AsyncFunction");
  });

  it("UI (presentation/app) neobsahuje frézovací vzorce - žádný soubor mimo domain/application neimportuje domain/calculation-engine/milling", () => {
    const presentationFiles = [...collectTsFiles(join(SRC_ROOT, "presentation")), ...collectTsFiles(join(SRC_ROOT, "app"))];
    const offenders: string[] = [];
    for (const file of presentationFiles) {
      const code = stripComments(readFileSync(file, "utf-8"));
      for (const line of code.match(IMPORT_LINE) ?? []) {
        // Fáze H: presentation SMÍ importovat application/calculation-engine/milling
        // (kompoziční kořen `calculation-engine-dependencies.ts`) - zakázaný je jen
        // přímý import z domain vrstvy.
        if (/domain\/calculation-engine\/milling/i.test(line)) offenders.push(`${file}: ${line.trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("UI (presentation/app) neobsahuje přímý vzorec 'Math.PI' pro odvození otáček - jen doména", () => {
    const presentationFiles = [...collectTsFiles(join(SRC_ROOT, "presentation")), ...collectTsFiles(join(SRC_ROOT, "app"))];
    const offenders: string[] = [];
    for (const file of presentationFiles) {
      const code = stripComments(readFileSync(file, "utf-8"));
      if (/Math\.PI/.test(code)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });

  it("Calculation Engine neobsahuje konkrétní ERP názvy (Helios/SAP/K2/...)", () => {
    const offenders: string[] = [];
    for (const file of millingFiles) {
      const code = stripComments(readFileSync(file, "utf-8"));
      if (/\b(helios|sap|k2|abra)\b/i.test(code)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });

  it("všechny frézovací výpočty procházejí přes CalculationStrategyRegistry - 'new MillingCalculationStrategy(' se používá jen v kompozičním kořeni a testech", () => {
    const allFiles = [
      ...collectTsFiles(join(SRC_ROOT, "domain")),
      ...collectTsFiles(join(SRC_ROOT, "application")),
      ...collectTsFiles(join(SRC_ROOT, "infrastructure")),
      ...collectTsFiles(join(SRC_ROOT, "presentation")),
      ...collectTsFiles(join(SRC_ROOT, "app")),
    ];
    const filesInstantiatingDirectly = allFiles.filter((f) => /new MillingCalculationStrategy\(/.test(readFileSync(f, "utf-8")));
    const allowList = filesInstantiatingDirectly.filter((f) => f.endsWith("calculation-strategy-registry-factory.ts"));
    expect(filesInstantiatingDirectly.sort()).toEqual(allowList.sort());
  });

  it("registry zůstává rozšiřitelný - žádné 'if (category === \"milling\")' větvení, jen Map.get/set", () => {
    const registryFile = join(SRC_ROOT, "domain", "calculation-engine", "services", "calculation-strategy-registry.ts");
    const engineFile = join(SRC_ROOT, "domain", "calculation-engine", "services", "calculation-engine.ts");
    for (const file of [registryFile, engineFile]) {
      const code = stripComments(readFileSync(file, "utf-8"));
      expect(code).not.toMatch(/["']milling["']/);
    }
  });

  it("TurningCalculationStrategy nebyla kvůli frézování měněna - obsahuje jen 'turning', žádnou milling logiku", () => {
    const code = stripComments(readFileSync(TURNING_STRATEGY_FILE, "utf-8"));
    expect(code).not.toMatch(/milling/i);
    expect(new TurningCalculationStrategy().strategyVersion).toBe("turning-1.0.0");
  });

  it("starý LegacyCalculationEngine (domain/services/calculation-engine.ts) zůstává dostupný jako fallback", () => {
    expect(existsSync(join(SRC_ROOT, "domain", "services", "calculation-engine.ts"))).toBe(true);
  });

  it("nové výsledky používají algorithmVersion 'mce-v1' a strategyVersion 'milling-1.0.0'", () => {
    const registry = new InMemoryCalculationStrategyRegistry();
    const strategy = new MillingCalculationStrategy();
    registry.register(strategy);
    const engine = new DefaultCalculationEngine(registry);

    expect(engine.engineVersion).toBe("mce-v1");
    expect(strategy.strategyVersion).toBe("milling-1.0.0");
    expect(strategy.operationCategory).toBe("milling");
  });
});
