import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { CylindricalGrindingCalculationStrategy } from "@/domain/calculation-engine/grinding/cylindrical-grinding-calculation-strategy";
import { SurfaceGrindingCalculationStrategy } from "@/domain/calculation-engine/grinding/surface-grinding-calculation-strategy";
import { GrindingCalculationStrategy } from "@/domain/calculation-engine/grinding/grinding-calculation-strategy";
import { TurningCalculationStrategy } from "@/domain/calculation-engine/turning/turning-calculation-strategy";
import { MillingCalculationStrategy } from "@/domain/calculation-engine/milling/milling-calculation-strategy";
import { DefaultCalculationEngine } from "@/domain/calculation-engine/services/calculation-engine";
import { InMemoryCalculationStrategyRegistry } from "@/domain/calculation-engine/services/calculation-strategy-registry";

/**
 * Architektonické testy Fáze E (AP-MCE-001 §23) - stejná technika jako Fáze
 * C/D `*-strategy-layering.test.ts`.
 */

const SRC_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const GRINDING_DIR = join(SRC_ROOT, "domain", "calculation-engine", "grinding");
const TURNING_STRATEGY_FILE = join(SRC_ROOT, "domain", "calculation-engine", "turning", "turning-calculation-strategy.ts");
const MILLING_STRATEGY_FILE = join(SRC_ROOT, "domain", "calculation-engine", "milling", "milling-calculation-strategy.ts");

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

describe("Grinding strategies - architektonické testy (AP-MCE-001 Fáze E §23)", () => {
  const grindingFiles = collectTsFiles(GRINDING_DIR);

  it("domain/calculation-engine/grinding neimportuje žádný *-repository (strategie nemá přístup k repozitáři)", () => {
    const offenders: string[] = [];
    for (const file of grindingFiles) {
      const code = stripComments(readFileSync(file, "utf-8"));
      for (const line of code.match(IMPORT_LINE) ?? []) {
        if (/repositor(y|ies)/i.test(line)) offenders.push(`${file}: ${line.trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("domain/calculation-engine/grinding neimportuje React, Tauri ani infrastructure", () => {
    const offenders: string[] = [];
    for (const file of grindingFiles) {
      const code = stripComments(readFileSync(file, "utf-8"));
      for (const line of code.match(IMPORT_LINE) ?? []) {
        if (/^\s*import\s+.*from\s+["'](react|@tauri-apps)/i.test(line) || /infrastructure|indexeddb/i.test(line)) {
          offenders.push(`${file}: ${line.trim()}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("domain/calculation-engine/grinding neimportuje domain/calculation-engine/turning ani milling (technologické moduly jsou nezávislé)", () => {
    const offenders: string[] = [];
    for (const file of grindingFiles) {
      const code = stripComments(readFileSync(file, "utf-8"));
      for (const line of code.match(IMPORT_LINE) ?? []) {
        if (/calculation-engine\/(turning|milling)/i.test(line)) offenders.push(`${file}: ${line.trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("Grinding strategie jsou čisté - žádná metoda instance nevrací Promise", () => {
    for (const strategy of [new CylindricalGrindingCalculationStrategy(), new SurfaceGrindingCalculationStrategy(), new GrindingCalculationStrategy()]) {
      expect(strategy.calculate.constructor.name).not.toBe("AsyncFunction");
      expect(strategy.validate.constructor.name).not.toBe("AsyncFunction");
    }
  });

  it("UI (presentation/app) neobsahuje brusírenské vzorce - žádný soubor mimo domain/application neimportuje domain/calculation-engine/grinding", () => {
    const presentationFiles = [...collectTsFiles(join(SRC_ROOT, "presentation")), ...collectTsFiles(join(SRC_ROOT, "app"))];
    const offenders: string[] = [];
    for (const file of presentationFiles) {
      const code = stripComments(readFileSync(file, "utf-8"));
      for (const line of code.match(IMPORT_LINE) ?? []) {
        // Fáze H: presentation SMÍ importovat application/calculation-engine/grinding
        // (kompoziční kořen `calculation-engine-dependencies.ts`) - zakázaný je jen
        // přímý import z domain vrstvy.
        if (/domain\/calculation-engine\/grinding/i.test(line)) offenders.push(`${file}: ${line.trim()}`);
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
    for (const file of grindingFiles) {
      const code = stripComments(readFileSync(file, "utf-8"));
      if (/\b(helios|sap|k2|abra)\b/i.test(code)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });

  it("registry zůstává rozšiřitelný - žádné 'if (category === \"grinding\")' větvení, jen Map.get/set", () => {
    const registryFile = join(SRC_ROOT, "domain", "calculation-engine", "services", "calculation-strategy-registry.ts");
    const engineFile = join(SRC_ROOT, "domain", "calculation-engine", "services", "calculation-engine.ts");
    for (const file of [registryFile, engineFile]) {
      const code = stripComments(readFileSync(file, "utf-8"));
      expect(code).not.toMatch(/["']grinding["']/);
    }
  });

  it("TurningCalculationStrategy nebyla kvůli broušení měněna - neobsahuje 'grinding'", () => {
    const code = stripComments(readFileSync(TURNING_STRATEGY_FILE, "utf-8"));
    expect(code).not.toMatch(/grinding/i);
    expect(new TurningCalculationStrategy().strategyVersion).toBe("turning-1.0.0");
  });

  it("MillingCalculationStrategy nebyla kvůli broušení měněna - neobsahuje 'grinding'", () => {
    const code = stripComments(readFileSync(MILLING_STRATEGY_FILE, "utf-8"));
    expect(code).not.toMatch(/grinding/i);
    expect(new MillingCalculationStrategy().strategyVersion).toBe("milling-1.0.0");
  });

  it("nové výsledky používají algorithmVersion 'mce-v1' a strategyVersion odpovídá příslušné strategii", () => {
    const registry = new InMemoryCalculationStrategyRegistry();
    const dispatcher = new GrindingCalculationStrategy();
    registry.register(dispatcher);
    const engine = new DefaultCalculationEngine(registry);

    expect(engine.engineVersion).toBe("mce-v1");
    expect(dispatcher.operationCategory).toBe("grinding");
    expect(new CylindricalGrindingCalculationStrategy().strategyVersion).toBe("cylindrical-grinding-1.0.0");
    expect(new SurfaceGrindingCalculationStrategy().strategyVersion).toBe("surface-grinding-1.0.0");
  });

  it("pouze GrindingCalculationStrategy (dispatcher) se registruje přímo v kompozičním kořeni - 'new CylindricalGrindingCalculationStrategy('/'new SurfaceGrindingCalculationStrategy(' mimo dispatcher/testy se nepoužívá", () => {
    const allFiles = [
      ...collectTsFiles(join(SRC_ROOT, "domain")),
      ...collectTsFiles(join(SRC_ROOT, "application")),
      ...collectTsFiles(join(SRC_ROOT, "infrastructure")),
      ...collectTsFiles(join(SRC_ROOT, "presentation")),
      ...collectTsFiles(join(SRC_ROOT, "app")),
    ];
    const cylindricalInstantiators = allFiles.filter((f) => /new CylindricalGrindingCalculationStrategy\(/.test(readFileSync(f, "utf-8")));
    const surfaceInstantiators = allFiles.filter((f) => /new SurfaceGrindingCalculationStrategy\(/.test(readFileSync(f, "utf-8")));
    const allowList = [join(SRC_ROOT, "domain", "calculation-engine", "grinding", "grinding-calculation-strategy.ts")];
    expect(cylindricalInstantiators).toEqual(allowList);
    expect(surfaceInstantiators).toEqual(allowList);

    const dispatcherInstantiators = allFiles.filter((f) => /new GrindingCalculationStrategy\(/.test(readFileSync(f, "utf-8")));
    const dispatcherAllowList = dispatcherInstantiators.filter((f) => f.endsWith("calculation-strategy-registry-factory.ts"));
    expect(dispatcherInstantiators.sort()).toEqual(dispatcherAllowList.sort());
  });

  it("starý LegacyCalculationEngine (domain/services/calculation-engine.ts) zůstává dostupný jako fallback", () => {
    expect(existsSync(join(SRC_ROOT, "domain", "services", "calculation-engine.ts"))).toBe(true);
  });
});
