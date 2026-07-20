import { describe, it, expect } from "vitest";
import { ValidationError } from "@/domain/errors/validation-error";
import { Machine } from "@/domain/entities/machine";
import { MachineCode } from "@/domain/value-objects/machine-code";
import { HourlyRate } from "@/domain/value-objects/hourly-rate";
import { MachineLimitError } from "../errors/machine-limit-error";
import { MachineProfile } from "./machine-profile";
import { MachineProfileFactory } from "./machine-profile-factory";
import { MachineWorkEnvelope } from "./machine-work-envelope";
import { MachineCorrection } from "./machine-correction";
import { resolveMachineProfileOverlay } from "./machine-profile-overlay";
import { MachineProfileSnapshot } from "./machine-profile-snapshot";

function baseMachine(overrides: Partial<Parameters<typeof Machine.create>[0]> = {}) {
  return Machine.create({
    id: "machine:1", tenantId: "tenant:acme", code: MachineCode.create("SP-430"), name: "Soustruh SP-430",
    maxRpm: 4000, maxPowerKw: 15, hourlyRate: HourlyRate.of(900, "CZK"), status: "active", capacityGroupId: "capacity-group:1",
    ...overrides,
  });
}

function systemProfile(overrides: Partial<Parameters<typeof MachineProfileFactory.createFromMachine>[0]> = {}) {
  return MachineProfileFactory.createFromMachine({
    id: "machine-profile:1", machine: baseMachine(),
    workEnvelope: MachineWorkEnvelope.create({ maxDiameterMm: 300, maxLengthMm: 1000 }),
    maxPartWeightKg: 150, now: "2025-01-01T00:00:00.000Z",
    ...overrides,
  });
}

describe("MachineProfileFactory.createFromMachine", () => {
  it("id profilu je odlišné od physicalMachineId", () => {
    const profile = systemProfile();
    expect(profile.id).toBe("machine-profile:1");
    expect(profile.physicalMachineId).toBe("machine:1");
  });

  it("logicalWorkstationId se převezme z machine.capacityGroupId", () => {
    expect(systemProfile().logicalWorkstationId).toBe("capacity-group:1");
  });

  it("performanceCoefficient je součin power/age/condition (výchozí 1×1×1=1)", () => {
    expect(systemProfile().performanceCoefficient).toBe(1);
  });
});

describe("MachineProfile - Scénář 5: díl/operace překročí maximální otáčky", () => {
  it("assertWithinLimits vyhodí MachineLimitError nad maxRpm", () => {
    const profile = systemProfile();
    expect(() => profile.assertWithinLimits({ requestedRpm: 5000 })).toThrow(MachineLimitError);
  });

  it("projde pro otáčky v limitu", () => {
    expect(systemProfile().assertWithinLimits({ requestedRpm: 3000 })).toEqual([]);
  });
});

describe("MachineProfile - Scénář 6: díl překročí pracovní prostor stroje", () => {
  it("assertWithinLimits vyhodí MachineLimitError, pokud díl nevejde do workEnvelope", () => {
    const profile = systemProfile();
    expect(() => profile.assertWithinLimits({ partDimensions: { maxDiameterMm: 350 } })).toThrow(MachineLimitError);
  });

  it("chybějící rozměr na kterékoliv straně se nevyhodnocuje jako překročení", () => {
    const profile = systemProfile();
    expect(profile.assertWithinLimits({ partDimensions: { maxHeightMm: 50 } })).toEqual([]);
  });
});

describe("MachineProfile - Scénář 7: díl překročí maximální hmotnost", () => {
  it("assertWithinLimits vyhodí MachineLimitError nad maxPartWeightKg", () => {
    const profile = systemProfile();
    expect(() => profile.assertWithinLimits({ partWeightKg: 200 })).toThrow(MachineLimitError);
  });
});

describe("MachineProfile - výkon (jen warning, ne blokující chyba, AP-MCE-001 §18)", () => {
  it("překročení výkonu vrátí warning, NEVYHODÍ výjimku", () => {
    const profile = systemProfile();
    const issues = profile.assertWithinLimits({ requestedPowerKw: 20 });
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("warning");
    expect(issues[0].code).toBe("MACHINE_POWER_EXCEEDED");
  });
});

describe("MachineProfile - Scénář 8: chybějící schopnost stroje", () => {
  it("assertWithinLimits vrátí warning pro chybějící požadovanou funkci", () => {
    const profile = systemProfile();
    const issues = profile.assertWithinLimits({ requiredFunctionCodes: ["LIVE_TOOLING"] });
    expect(issues[0].code).toBe("MACHINE_CAPABILITY_MISSING");
    expect(issues[0].field).toBe("LIVE_TOOLING");
  });

  it("hasFunction rozezná přítomnou funkci", () => {
    const profile = MachineProfileFactory.createFromMachine({
      id: "machine-profile:2", machine: baseMachine({ id: "machine:2" }),
      availableFunctions: [{ capabilityTypeId: "cap:1", capabilityTypeCode: "LIVE_TOOLING", value: true }],
      now: "2025-01-01T00:00:00.000Z",
    });
    expect(profile.hasFunction("LIVE_TOOLING")).toBe(true);
    expect(profile.assertWithinLimits({ requiredFunctionCodes: ["LIVE_TOOLING"] })).toEqual([]);
  });
});

describe("MachineProfile - overlay (systém + korekce)", () => {
  it("korekce upraví koeficienty, systémový profil zůstane nezměněný", () => {
    const system = systemProfile();
    const correction = MachineCorrection.create({
      id: "correction:1", tenantId: "tenant:acme", machineProfileId: system.id,
      conditionCoefficient: 1.2, reason: "Stroj je opotřebovaný, reálně obrábí pomaleji.",
      recordVersion: 1, createdAt: "2025-02-01T00:00:00.000Z", updatedAt: "2025-02-01T00:00:00.000Z",
    });

    const resolved = resolveMachineProfileOverlay(system, correction);

    expect(resolved.conditionCoefficient).toBe(1.2);
    expect(resolved.performanceCoefficient).toBeCloseTo(1.2);
    expect(system.conditionCoefficient).toBe(1);
    expect(resolved.recordVersion).toBe(system.recordVersion); // overlay nevytváří novou persistovanou verzi
  });

  it("korekce nemůže změnit fyzické limity (maxRpm/workEnvelope)", () => {
    const system = systemProfile();
    const correction = MachineCorrection.create({
      id: "correction:1", tenantId: "tenant:acme", machineProfileId: system.id,
      reason: "…", recordVersion: 1, createdAt: "2025-02-01T00:00:00.000Z", updatedAt: "2025-02-01T00:00:00.000Z",
    });
    const resolved = resolveMachineProfileOverlay(system, correction);
    expect(resolved.maxRpm).toBe(system.maxRpm);
  });
});

describe("MachineProfile - validace a immutabilita", () => {
  it("odmítne minRpm > maxRpm", () => {
    expect(() =>
      MachineProfile.create({
        id: "p", tenantId: "t", externalReferences: [], physicalMachineId: "m", minRpm: 5000, maxRpm: 1000,
        availableFunctions: [], powerCoefficient: 1, ageCoefficient: 1, conditionCoefficient: 1, typicalSetupTimes: [],
        recordVersion: 1, createdAt: "2025-01-01T00:00:00.000Z", updatedAt: "2025-01-01T00:00:00.000Z",
      })
    ).toThrow(ValidationError);
  });

  it("odmítne nekladný koeficient", () => {
    expect(() => systemProfile().withChanges({ powerCoefficient: -1 }, "2025-01-02T00:00:00.000Z")).toThrow(ValidationError);
  });
});

describe("MachineProfileSnapshot", () => {
  it("je immutable a nezávisí na pozdější změně profilu", () => {
    const resolved = systemProfile();
    const snapshot = MachineProfileSnapshot.forMachineProfile(resolved, { systemVersion: 1, createdAt: "2025-01-01T00:00:00.000Z" });
    resolved.withChanges({ powerCoefficient: 1.5 }, "2025-06-01T00:00:00.000Z");
    expect((snapshot.resolvedData as { powerCoefficient: number }).powerCoefficient).toBe(1);
  });
});
