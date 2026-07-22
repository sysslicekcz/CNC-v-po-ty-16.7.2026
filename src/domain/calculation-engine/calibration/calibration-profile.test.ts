import { describe, it, expect } from "vitest";
import { CalibrationProfile, CalibrationProfileProps } from "./calibration-profile";

/**
 * Unit testy pro `CalibrationProfile` (AP-MCE-001 Fáze G §13, součást 60
 * scénářů §28).
 */

const NOW = "2025-06-01T00:00:00.000Z";

function props(overrides: Partial<CalibrationProfileProps> = {}): CalibrationProfileProps {
  return {
    id: "cp:1",
    tenantId: "tenant:acme",
    name: "Global cutting profile",
    scope: "tenant",
    coefficientTargets: [],
    sampleCount: 20,
    effectiveSampleCount: 15,
    coefficientValues: { cuttingCoefficient: 1.1 },
    confidenceScore: 0.8,
    status: "active",
    calibrationMethod: "weighted_mean",
    validFrom: "2025-01-01T00:00:00.000Z",
    recordVersion: 1,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("CalibrationProfile (AP-MCE-001 Fáze G §13)", () => {
  it("1. 'isValidAt' respektuje validFrom/validTo okno", () => {
    const profile = CalibrationProfile.create(props({ validFrom: "2025-01-01T00:00:00.000Z", validTo: "2025-03-01T00:00:00.000Z" }));
    expect(profile.isValidAt("2025-02-01T00:00:00.000Z")).toBe(true);
    expect(profile.isValidAt(NOW)).toBe(false);
  });

  it("2. jen status 'active' je 'isUsableInCalculation'", () => {
    const active = CalibrationProfile.create(props({ status: "active" }));
    const approved = CalibrationProfile.create(props({ status: "approved" }));
    expect(active.isUsableInCalculation).toBe(true);
    expect(approved.isUsableInCalculation).toBe(false);
  });

  it("3. 'supersede' vytvoří novou instanci se statusem 'superseded', stará instance je nezměněná", () => {
    const profile = CalibrationProfile.create(props());
    const superseded = profile.supersede(NOW);
    expect(superseded).not.toBe(profile);
    expect(superseded.status).toBe("superseded");
    expect(profile.status).toBe("active");
  });

  it("4. 'archive' nastaví 'archivedAt' a 'isValidAt' pak vždy vrátí false", () => {
    const profile = CalibrationProfile.create(props());
    const archived = profile.archive(NOW);
    expect(archived.archivedAt).toBe(NOW);
    expect(archived.isValidAt("2025-02-01T00:00:00.000Z")).toBe(false);
  });
});
