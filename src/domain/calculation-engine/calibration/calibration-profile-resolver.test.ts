import { describe, it, expect } from "vitest";
import { CalibrationProfile, CalibrationProfileProps } from "./calibration-profile";
import { resolveCalibrationProfile } from "./calibration-profile-resolver";

/**
 * Unit testy pro `CalibrationProfileResolver` (AP-MCE-001 Fáze G §19,
 * součást 60 scénářů §28).
 */

const NOW = "2025-06-01T00:00:00.000Z";
const TENANT_ID = "tenant:acme";

function profile(overrides: Partial<CalibrationProfileProps> = {}): CalibrationProfile {
  return CalibrationProfile.create({
    id: overrides.id ?? "cp:1",
    tenantId: TENANT_ID,
    name: "Profile",
    scope: "tenant",
    coefficientTargets: [],
    sampleCount: 20,
    effectiveSampleCount: 15,
    coefficientValues: {},
    confidenceScore: 0.8,
    status: "active",
    calibrationMethod: "weighted_mean",
    validFrom: "2025-01-01T00:00:00.000Z",
    recordVersion: 1,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  });
}

describe("resolveCalibrationProfile (AP-MCE-001 Fáze G §19)", () => {
  it("1. nejkonkrétnější rozsah (machine+material+tool) vyhraje nad obecnějšími", () => {
    const specific = profile({ id: "specific", scope: "machine_material_and_tool", machineProfileId: "m:1", materialGroupId: "mat:1", toolTypeId: "t:1" });
    const tenant = profile({ id: "tenant", scope: "tenant" });
    const result = resolveCalibrationProfile({
      candidates: [tenant, specific],
      tenantId: TENANT_ID,
      operationCategory: "turning",
      machineProfileId: "m:1",
      materialGroupId: "mat:1",
      toolTypeId: "t:1",
      now: NOW,
    });
    expect(result.selectedProfile?.id).toBe("specific");
    expect(result.matchedScope).toBe("machine_material_and_tool");
  });

  it("2. kandidát se statusem jiným než 'active' se ignoruje (obranné přefiltrování)", () => {
    const approved = profile({ id: "approved", status: "approved", scope: "machine", machineProfileId: "m:1" });
    const result = resolveCalibrationProfile({ candidates: [approved], tenantId: TENANT_ID, operationCategory: "turning", machineProfileId: "m:1", now: NOW });
    expect(result.selectedProfile).toBeUndefined();
  });

  it("3. bez shody na žádné úrovni vrátí selectedProfile: undefined s CALIBRATION_PROFILE_NOT_ACTIVE", () => {
    const result = resolveCalibrationProfile({ candidates: [], tenantId: TENANT_ID, operationCategory: "turning", now: NOW });
    expect(result.selectedProfile).toBeUndefined();
    expect(result.confidence).toBe(0);
    expect(result.warnings.some((w) => w.code === "CALIBRATION_PROFILE_NOT_ACTIVE")).toBe(true);
  });

  it("4. manuální operace (operationCategory 'manual') použije scope 'manual_operation' před 'workstation'", () => {
    const manualScope = profile({ id: "manual-scope", scope: "manual_operation" });
    const workstationScope = profile({ id: "workstation-scope", scope: "workstation", workstationId: "ws:1" });
    const result = resolveCalibrationProfile({
      candidates: [manualScope, workstationScope],
      tenantId: TENANT_ID,
      operationCategory: "manual",
      workstationId: "ws:1",
      now: NOW,
    });
    expect(result.selectedProfile?.id).toBe("manual-scope");
  });
});
