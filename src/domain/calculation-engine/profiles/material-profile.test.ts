import { describe, it, expect } from "vitest";
import { ValidationError } from "@/domain/errors/validation-error";
import { Material } from "@/domain/entities/material";
import { MaterialCode } from "@/domain/value-objects/material-code";
import { MaterialGroup } from "@/domain/entities/material-group";
import { MaterialGroupCode } from "@/domain/value-objects/material-group-code";
import { MaterialProfile } from "./material-profile";
import { MaterialProfileFactory } from "./material-profile-factory";
import { MaterialCorrection } from "./material-correction";
import { resolveMaterialProfileOverlay } from "./material-profile-overlay";
import { MaterialCuttingRecommendation } from "./material-cutting-recommendation";
import { MaterialProfileSnapshot } from "./material-profile-snapshot";

function systemMaterial(): Material {
  return Material.create({
    id: "material:1", tenantId: "tenant:acme", code: MaterialCode.create("OCEL-11523"),
    name: "Ocel 11 523", materialGroupId: "material-group:1", standard: "ČSN", hardness: 200,
    densityKgPerM3: 7850, status: "active",
  });
}

function systemGroup(): MaterialGroup {
  return MaterialGroup.create({ id: "material-group:1", tenantId: "tenant:acme", code: MaterialGroupCode.create("OCEL"), name: "Konstrukční oceli", status: "active" });
}

function systemProfile(): MaterialProfile {
  return MaterialProfileFactory.createFromMaterial({
    material: systemMaterial(), materialGroup: systemGroup(), sourceType: "system",
    dataSource: "master-data:material", now: "2025-01-01T00:00:00.000Z",
  });
}

describe("MaterialProfileFactory.createFromMaterial", () => {
  it("id profilu je shodné s Material.id (stejná identita)", () => {
    expect(systemProfile().id).toBe("material:1");
  });

  it("zkopíruje popisná pole z Material/MaterialGroup", () => {
    const profile = systemProfile();
    expect(profile.name).toBe("Ocel 11 523");
    expect(profile.materialGroupName).toBe("Konstrukční oceli");
    expect(profile.hardness).toBe(200);
    expect(profile.materialCoefficient).toBe(1); // výchozí
  });
});

describe("MaterialProfile - Scénář 1/2/3: systémový materiál + tenant correction", () => {
  it("Scénář 3: čistě zákaznický profil (sourceType 'tenant') se vytvoří stejnou cestou", () => {
    const tenantMaterial = Material.create({
      id: "material:tenant-1", tenantId: "tenant:acme", code: MaterialCode.create("VLASTNI-1"),
      name: "Vlastní slitina", materialGroupId: "material-group:1", status: "active",
    });
    const profile = MaterialProfileFactory.createFromMaterial({
      material: tenantMaterial, materialGroup: systemGroup(), sourceType: "tenant",
      dataSource: "manual", now: "2025-01-01T00:00:00.000Z",
    });
    expect(profile.sourceType).toBe("tenant");
  });

  it("Scénář 1: tenant correction upraví koeficient, systémový profil zůstane nezměněný (Scénář 2)", () => {
    const system = systemProfile();
    const correction = MaterialCorrection.create({
      id: "correction:1", tenantId: "tenant:acme", materialProfileId: system.id,
      materialCoefficient: 1.15, reason: "Naše zkušenost s tímhle materiálem je pomalejší obrábění.",
      recordVersion: 1, createdAt: "2025-02-01T00:00:00.000Z", updatedAt: "2025-02-01T00:00:00.000Z",
    });

    const resolved = resolveMaterialProfileOverlay(system, correction);

    expect(resolved.materialCoefficient).toBe(1.15);
    // Scénář 2: systémový profil zůstal nezměněný.
    expect(system.materialCoefficient).toBe(1);
    expect(resolved).not.toBe(system);
  });

  it("bez korekce vrátí resolver stejnou instanci (žádná zbytečná kopie)", () => {
    const system = systemProfile();
    expect(resolveMaterialProfileOverlay(system)).toBe(system);
  });

  it("archivovaná korekce se ignoruje, resolver vrátí systémový profil", () => {
    const system = systemProfile();
    const archivedCorrection = MaterialCorrection.create({
      id: "correction:1", tenantId: "tenant:acme", materialProfileId: system.id,
      materialCoefficient: 2, reason: "…", recordVersion: 1,
      createdAt: "2025-02-01T00:00:00.000Z", updatedAt: "2025-02-01T00:00:00.000Z", archivedAt: "2025-03-01T00:00:00.000Z",
    });
    expect(resolveMaterialProfileOverlay(system, archivedCorrection)).toBe(system);
  });

  it("korekce pro jiný profil vyhodí chybu", () => {
    const system = systemProfile();
    const mismatchedCorrection = MaterialCorrection.create({
      id: "correction:1", tenantId: "tenant:acme", materialProfileId: "material:jiny",
      reason: "…", recordVersion: 1, createdAt: "2025-02-01T00:00:00.000Z", updatedAt: "2025-02-01T00:00:00.000Z",
    });
    expect(() => resolveMaterialProfileOverlay(system, mismatchedCorrection)).toThrow();
  });

  it("korekce nemůže přepsat identitu (name/materialGroupId) - overlay ta pole vůbec nepřebírá z korekce", () => {
    const system = systemProfile();
    const correction = MaterialCorrection.create({
      id: "correction:1", tenantId: "tenant:acme", materialProfileId: system.id, notes: "poznámka",
      reason: "…", recordVersion: 1, createdAt: "2025-02-01T00:00:00.000Z", updatedAt: "2025-02-01T00:00:00.000Z",
    });
    const resolved = resolveMaterialProfileOverlay(system, correction);
    expect(resolved.name).toBe(system.name);
    expect(resolved.notes).toBe("poznámka");
  });
});

describe("MaterialProfile - doporučené řezné podmínky", () => {
  it("bestCuttingSpeedFor vybere doporučení s nejvyšší confidence z odpovídajících", () => {
    const rec1 = MaterialCuttingRecommendation.create({
      operationCategory: "turning", recommendedValue: 120, unit: "m/min", source: "manufacturer", confidence: 0.9,
    });
    const rec2 = MaterialCuttingRecommendation.create({
      operationCategory: "turning", recommendedValue: 100, unit: "m/min", source: "internal", confidence: 0.6,
    });
    const profile = systemProfile().withChanges({ recommendedCuttingSpeeds: [rec2, rec1] }, "2025-01-02T00:00:00.000Z");
    expect(profile.bestCuttingSpeedFor({ operationCategory: "turning" })?.recommendedValue).toBe(120);
  });

  it("nevrátí doporučení pro jinou kategorii operace", () => {
    const rec = MaterialCuttingRecommendation.create({
      operationCategory: "milling", recommendedValue: 80, unit: "m/min", source: "internal", confidence: 0.7,
    });
    const profile = systemProfile().withChanges({ recommendedCuttingSpeeds: [rec] }, "2025-01-02T00:00:00.000Z");
    expect(profile.bestCuttingSpeedFor({ operationCategory: "turning" })).toBeUndefined();
  });
});

describe("MaterialProfile - validace a immutabilita", () => {
  it("odmítne nekladný materialCoefficient", () => {
    expect(() => systemProfile().withChanges({ materialCoefficient: 0 }, "2025-01-02T00:00:00.000Z")).toThrow(ValidationError);
  });

  it("withChanges vrací NOVOU instanci se zvýšeným recordVersion", () => {
    const v1 = systemProfile();
    const v2 = v1.withChanges({ notes: "aktualizace" }, "2025-01-02T00:00:00.000Z");
    expect(v2.recordVersion).toBe(2);
    expect(v1.recordVersion).toBe(1);
    expect(v2).not.toBe(v1);
  });

  it("archive je idempotentní a nastaví archivedAt", () => {
    const archived = systemProfile().archive("2025-06-01T00:00:00.000Z");
    expect(archived.isArchived).toBe(true);
    expect(archived.archive("2025-07-01T00:00:00.000Z").archivedAt).toBe("2025-06-01T00:00:00.000Z");
  });
});

describe("MaterialProfileSnapshot", () => {
  it("Scénář 16/17: snapshot je immutable a nezmění se po pozdější úpravě profilu", () => {
    const resolved = systemProfile();
    const snapshot = MaterialProfileSnapshot.forMaterialProfile(resolved, { systemVersion: 1, createdAt: "2025-01-01T00:00:00.000Z" });

    resolved.withChanges({ notes: "pozdější změna" }, "2025-06-01T00:00:00.000Z"); // nová instance, snapshot to nevidí

    expect(snapshot.resolvedData.notes).toBeUndefined();
    expect(() => {
      (snapshot.resolvedData as Record<string, unknown>).notes = "napadeno";
    }).toThrow();
  });

  it("checksum je deterministický pro stejná data", () => {
    const resolved = systemProfile();
    const s1 = MaterialProfileSnapshot.forMaterialProfile(resolved, { systemVersion: 1, createdAt: "2025-01-01T00:00:00.000Z" });
    const s2 = MaterialProfileSnapshot.forMaterialProfile(resolved, { systemVersion: 1, createdAt: "2025-01-01T00:00:00.000Z" });
    expect(s1.checksum).toBe(s2.checksum);
  });
});
