import { describe, it, expect } from "vitest";
import { ValidationError } from "@/domain/errors/validation-error";
import { Tool } from "@/domain/entities/tool";
import { ToolType } from "@/domain/entities/tool-type";
import { ToolProfile } from "./tool-profile";
import { ToolProfileFactory } from "./tool-profile-factory";
import { ToolLifeProfile } from "./tool-life-profile";
import { ToolWearCurve } from "./tool-wear-curve";
import { ToolCorrection } from "./tool-correction";
import { resolveToolProfileOverlay } from "./tool-profile-overlay";
import { ToolMaterialCompatibilityService } from "./tool-material-compatibility-service";
import { ToolProfileSnapshot } from "./tool-profile-snapshot";

function baseTool() {
  return Tool.create({ id: "tool:1", tenantId: "tenant:acme", nazev: "Vrták Ø10", toolTypeId: "tool-type:1", stav: "aktivni" });
}

function baseToolType() {
  return ToolType.create({ id: "tool-type:1", tenantId: "tenant:acme", kod: "VRTAK", nazev: "Vrták", category: "drill", parameterDefinitions: [], stav: "aktivni" });
}

function systemProfile() {
  return ToolProfileFactory.createFromTool({
    tool: baseTool(), toolType: baseToolType(), suitableMaterialGroupIds: ["material-group:ocel"],
    now: "2025-01-01T00:00:00.000Z",
  });
}

describe("ToolProfileFactory.createFromTool", () => {
  it("id profilu je shodné s Tool.id", () => {
    expect(systemProfile().id).toBe("tool:1");
  });

  it("toolTypeName se převezme z ToolType.nazev", () => {
    expect(systemProfile().toolTypeName).toBe("Vrták");
  });

  it("bez wearFactorCurve dostane plochou (flat) křivku", () => {
    expect(systemProfile().wearFactorCurve.factorAt(50)).toBe(1);
  });
});

describe("ToolLifeProfile - Scénář 11/12: životnost v kusech a v minutách", () => {
  it("Scénář 11: očekávaný počet výměn podle kusů", () => {
    const life = ToolLifeProfile.ofPieces(100);
    expect(life.expectedToolChanges(350)).toBe(4); // ceil(350/100)
  });

  it("Scénář 12: očekávaný počet výměn podle minut řezu", () => {
    const life = ToolLifeProfile.ofMinutes(60);
    expect(life.expectedToolChanges(100, 1)).toBe(2); // 100 ks × 1 min = 100 min, ceil(100/60) = 2
  });

  it("obě hodnoty současně - rozhoduje přísnější hranice", () => {
    const life = ToolLifeProfile.ofBoth(1000, 30); // 1000 ks NEBO 30 min
    // 100 ks × 1 min = 100 min -> ceil(100/30) = 4 výměny podle času, ceil(100/1000) = 1 podle kusů -> vyhrává čas
    expect(life.expectedToolChanges(100, 1)).toBe(4);
  });

  it("neznámá životnost vrátí 0 výměn", () => {
    expect(ToolLifeProfile.unknown().isUnknown).toBe(true);
    expect(ToolLifeProfile.unknown().expectedToolChanges(500)).toBe(0);
  });
});

describe("ToolWearCurve - deterministická a verzovaná", () => {
  it("stejný pieceIndex vždy dá stejný výsledek", () => {
    const curve = ToolWearCurve.fromPoints([{ pieceIndex: 1, wearFactor: 1 }, { pieceIndex: 100, wearFactor: 1.3 }], "v1");
    expect(curve.factorAt(50)).toBe(curve.factorAt(50));
  });

  it("lineárně interpoluje mezi body", () => {
    const curve = ToolWearCurve.fromPoints([{ pieceIndex: 1, wearFactor: 1 }, { pieceIndex: 101, wearFactor: 2 }], "v1");
    expect(curve.factorAt(51)).toBeCloseTo(1.5);
  });

  it("před prvním a za posledním bodem drží konstantní hodnotu (žádná extrapolace)", () => {
    const curve = ToolWearCurve.fromPoints([{ pieceIndex: 10, wearFactor: 1 }, { pieceIndex: 20, wearFactor: 1.5 }], "v1");
    expect(curve.factorAt(1)).toBe(1);
    expect(curve.factorAt(1000)).toBe(1.5);
  });

  it("nese verzi křivky", () => {
    expect(ToolWearCurve.fromPoints([{ pieceIndex: 1, wearFactor: 1 }], "v2025-06").curveVersion).toBe("v2025-06");
  });
});

describe("ToolMaterialCompatibilityService - Scénář 9/10", () => {
  it("Scénář 9: vhodný nástroj a materiál nevrátí warning", () => {
    expect(ToolMaterialCompatibilityService.check(systemProfile(), "material-group:ocel")).toEqual([]);
  });

  it("Scénář 10: nevhodná kombinace vrátí warning, nevyhodí výjimku", () => {
    const issues = ToolMaterialCompatibilityService.check(systemProfile(), "material-group:hlinik");
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("warning");
    expect(issues[0].code).toBe("TOOL_MATERIAL_MISMATCH");
  });

  it("prázdný seznam vhodných skupin = appka o vhodnosti nic neví, nevrací warning", () => {
    const unrestricted = ToolProfileFactory.createFromTool({ tool: baseTool(), toolType: baseToolType(), now: "2025-01-01T00:00:00.000Z" });
    expect(ToolMaterialCompatibilityService.check(unrestricted, "cokoliv")).toEqual([]);
  });
});

describe("ToolProfile - overlay a validace", () => {
  it("korekce upraví toolLife, systémový profil zůstane nezměněný", () => {
    const system = systemProfile();
    const correction = ToolCorrection.create({
      id: "correction:1", tenantId: "tenant:acme", toolProfileId: system.id,
      toolLife: ToolLifeProfile.ofPieces(50), reason: "Reálná životnost je nižší.",
      recordVersion: 1, createdAt: "2025-02-01T00:00:00.000Z", updatedAt: "2025-02-01T00:00:00.000Z",
    });
    const resolved = resolveToolProfileOverlay(system, correction);
    expect(resolved.toolLife.pieceLimit?.value).toBe(50);
    expect(system.toolLife.isUnknown).toBe(true);
  });

  it("odmítne diameterMm <= 0", () => {
    expect(() => systemProfile().withChanges({ toolChangeTimeSec: -1 }, "2025-01-02T00:00:00.000Z")).not.toThrow(); // negative changeTime not validated separately - jen ukázka withChanges
    expect(() =>
      ToolProfile.create({
        id: "t", tenantId: "tn", externalReferences: [], toolTypeId: "tt", toolTypeName: "X", diameterMm: 0,
        suitableMaterialGroupIds: [], supportedOperationCategories: [], defaultCuttingParameters: [],
        toolLife: ToolLifeProfile.unknown(), wearFactorCurve: ToolWearCurve.flat(), recordVersion: 1,
        createdAt: "2025-01-01T00:00:00.000Z", updatedAt: "2025-01-01T00:00:00.000Z",
      })
    ).toThrow(ValidationError);
  });

  it("price vyžaduje currency", () => {
    expect(() =>
      ToolProfile.create({
        id: "t", tenantId: "tn", externalReferences: [], toolTypeId: "tt", toolTypeName: "X", price: 500,
        suitableMaterialGroupIds: [], supportedOperationCategories: [], defaultCuttingParameters: [],
        toolLife: ToolLifeProfile.unknown(), wearFactorCurve: ToolWearCurve.flat(), recordVersion: 1,
        createdAt: "2025-01-01T00:00:00.000Z", updatedAt: "2025-01-01T00:00:00.000Z",
      })
    ).toThrow(ValidationError);
  });
});

describe("ToolProfileSnapshot", () => {
  it("je immutable a nezávisí na pozdější změně profilu", () => {
    const resolved = systemProfile();
    const snapshot = ToolProfileSnapshot.forToolProfile(resolved, { systemVersion: 1, createdAt: "2025-01-01T00:00:00.000Z" });
    resolved.withChanges({ toolChangeTimeSec: 99 }, "2025-06-01T00:00:00.000Z");
    expect((snapshot.resolvedData as { toolChangeTimeSec?: number }).toolChangeTimeSec).toBeUndefined();
  });
});
