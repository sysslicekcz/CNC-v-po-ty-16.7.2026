import { describe, it, expect } from "vitest";
import { ShadowCalculationResult, ShadowCalculationResultProps, evaluateShadowCalibration } from "./shadow-mode";

/**
 * Unit testy pro shadow mode entity/vyhodnocení (AP-MCE-001 Fáze G §20,
 * součást 60 scénářů §28).
 */

const NOW = "2025-01-01T00:00:00.000Z";

function shadowProps(overrides: Partial<ShadowCalculationResultProps> = {}): ShadowCalculationResultProps {
  return {
    id: "scr:1",
    tenantId: "tenant:acme",
    officialCalculationId: "calc:1",
    officialCalculationRevision: 1,
    shadowCalibrationProfileId: "cp:shadow",
    shadowCalibrationProfileVersion: 1,
    shadowBreakdown: {},
    shadowTotalOperationTimeMin: 90,
    officialTotalOperationTimeMin: 100,
    computedAt: NOW,
    ...overrides,
  };
}

describe("ShadowCalculationResult (AP-MCE-001 Fáze G §20)", () => {
  it("1. 'differenceMin'/'differencePercent' se počítají ze shadow vs. official časů", () => {
    const result = ShadowCalculationResult.create(shadowProps());
    expect(result.differenceMin).toBeCloseTo(-10, 9);
    expect(result.differencePercent).toBeCloseTo(-10, 9);
  });

  it("2. 'differencePercent' je 0, pokud oficiální čas je 0 (bez dělení nulou)", () => {
    const result = ShadowCalculationResult.create(shadowProps({ officialTotalOperationTimeMin: 0, shadowTotalOperationTimeMin: 5 }));
    expect(result.differencePercent).toBe(0);
  });
});

describe("evaluateShadowCalibration (AP-MCE-001 Fáze G §20)", () => {
  it("3. dost vzorků + výrazné zlepšení => doporučení 'promote'", () => {
    const pairs = Array.from({ length: 12 }, () => ({ officialErrorMin: 10, shadowErrorMin: 2 }));
    const evaluation = evaluateShadowCalibration(pairs, "cp:shadow", 1, NOW);
    expect(evaluation.recommendation).toBe("promote");
  });

  it("4. dost vzorků + výrazné zhoršení => doporučení 'reject'", () => {
    const pairs = Array.from({ length: 12 }, () => ({ officialErrorMin: 2, shadowErrorMin: 10 }));
    const evaluation = evaluateShadowCalibration(pairs, "cp:shadow", 1, NOW);
    expect(evaluation.recommendation).toBe("reject");
  });

  it("5. nedostatek vzorků => doporučení vždy 'keep_shadow' bez ohledu na zlepšení", () => {
    const pairs = Array.from({ length: 3 }, () => ({ officialErrorMin: 10, shadowErrorMin: 1 }));
    const evaluation = evaluateShadowCalibration(pairs, "cp:shadow", 1, NOW);
    expect(evaluation.recommendation).toBe("keep_shadow");
  });
});
