import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { TurningCalculationStrategy } from "@/domain/calculation-engine/turning/turning-calculation-strategy";
import { DefaultCalculationEngine } from "@/domain/calculation-engine/services/calculation-engine";
import { InMemoryCalculationStrategyRegistry } from "@/domain/calculation-engine/services/calculation-strategy-registry";

/**
 * Architektonické testy Fáze C (AP-MCE-001 §20) - stejná technika jako
 * `erp-neutrality.test.ts`/`calculation-engine-layering.test.ts` (čte
 * zdrojové soubory, hledá zakázané importy/vzory).
 */

const SRC_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TURNING_DIR = join(SRC_ROOT, "domain", "calculation-engine", "turning");

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

describe("TurningCalculationStrategy - architektonické testy (AP-MCE-001 Fáze C §20)", () => {
  const turningFiles = collectTsFiles(TURNING_DIR);

  it("domain/calculation-engine/turning neimportuje žádný *-repository (strategie nemá přístup k repozitáři)", () => {
    const offenders: string[] = [];
    for (const file of turningFiles) {
      const code = stripComments(readFileSync(file, "utf-8"));
      for (const line of code.match(IMPORT_LINE) ?? []) {
        if (/repositor(y|ies)/i.test(line)) offenders.push(`${file}: ${line.trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("domain/calculation-engine/turning neimportuje React, Tauri ani infrastructure", () => {
    const offenders: string[] = [];
    for (const file of turningFiles) {
      const code = stripComments(readFileSync(file, "utf-8"));
      for (const line of code.match(IMPORT_LINE) ?? []) {
        if (/^\s*import\s+.*from\s+["'](react|@tauri-apps)/i.test(line) || /infrastructure|indexeddb/i.test(line)) {
          offenders.push(`${file}: ${line.trim()}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("TurningCalculationStrategy je čistá - žádná metoda instance nevrací Promise", () => {
    const strategy = new TurningCalculationStrategy();
    expect(strategy.validate).not.toHaveProperty("constructor.name", "AsyncFunction");
    expect(strategy.calculate).not.toHaveProperty("constructor.name", "AsyncFunction");
    expect(strategy.calculate.constructor.name).not.toBe("AsyncFunction");
    expect(strategy.validate.constructor.name).not.toBe("AsyncFunction");
  });

  it("UI (presentation/app) neobsahuje vzorce soustružení - žádný soubor mimo domain/application neimportuje domain/calculation-engine/turning", () => {
    const presentationFiles = [...collectTsFiles(join(SRC_ROOT, "presentation")), ...collectTsFiles(join(SRC_ROOT, "app"))];
    const offenders: string[] = [];
    for (const file of presentationFiles) {
      const code = stripComments(readFileSync(file, "utf-8"));
      for (const line of code.match(IMPORT_LINE) ?? []) {
        // Fáze H: presentation SMÍ importovat application/calculation-engine/turning
        // (kompoziční kořen `calculation-engine-dependencies.ts` wiruje existující
        // Application use cases) - zakázaný je jen přímý import z domain vrstvy.
        if (/domain\/calculation-engine\/turning/i.test(line)) offenders.push(`${file}: ${line.trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("UI (presentation/app) neobsahuje přímý vzorec 'π' / 'Math.PI' pro odvození otáček - jen doména", () => {
    const presentationFiles = [...collectTsFiles(join(SRC_ROOT, "presentation")), ...collectTsFiles(join(SRC_ROOT, "app"))];
    const offenders: string[] = [];
    for (const file of presentationFiles) {
      const code = stripComments(readFileSync(file, "utf-8"));
      if (/Math\.PI/.test(code)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });

  it("všechny soustružnické výpočty procházejí přes CalculationStrategyRegistry - 'new TurningCalculationStrategy(' se používá jen v kompozičním kořeni a testech", () => {
    const allFiles = [
      ...collectTsFiles(join(SRC_ROOT, "domain")),
      ...collectTsFiles(join(SRC_ROOT, "application")),
      ...collectTsFiles(join(SRC_ROOT, "infrastructure")),
      ...collectTsFiles(join(SRC_ROOT, "presentation")),
      ...collectTsFiles(join(SRC_ROOT, "app")),
    ];
    const filesInstantiatingDirectly = allFiles.filter((f) => /new TurningCalculationStrategy\(/.test(readFileSync(f, "utf-8")));
    const allowList = filesInstantiatingDirectly.filter((f) => f.endsWith("calculation-strategy-registry-factory.ts"));
    expect(filesInstantiatingDirectly.sort()).toEqual(allowList.sort());
  });

  it("registry nemá žádné 'if (category === \"turning\")' větvení - jen Map.get/set", () => {
    const registryFile = join(SRC_ROOT, "domain", "calculation-engine", "services", "calculation-strategy-registry.ts");
    const engineFile = join(SRC_ROOT, "domain", "calculation-engine", "services", "calculation-engine.ts");
    for (const file of [registryFile, engineFile]) {
      const code = stripComments(readFileSync(file, "utf-8"));
      expect(code).not.toMatch(/["']turning["']/);
    }
  });

  it("starý LegacyCalculationEngine (domain/services/calculation-engine.ts) zůstává dostupný jako fallback", () => {
    expect(existsSync(join(SRC_ROOT, "domain", "services", "calculation-engine.ts"))).toBe(true);
  });

  it("nové výsledky používají algorithmVersion 'mce-v1' a strategyVersion 'turning-1.0.0'", () => {
    const registry = new InMemoryCalculationStrategyRegistry();
    const strategy = new TurningCalculationStrategy();
    registry.register(strategy);
    const engine = new DefaultCalculationEngine(registry);

    expect(engine.engineVersion).toBe("mce-v1");
    expect(strategy.strategyVersion).toBe("turning-1.0.0");
    expect(strategy.operationCategory).toBe("turning");
  });
});
