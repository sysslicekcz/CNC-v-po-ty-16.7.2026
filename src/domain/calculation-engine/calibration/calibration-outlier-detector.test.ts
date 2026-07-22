import { describe, it, expect } from "vitest";
import { detectCalibrationOutliers, median } from "./calibration-outlier-detector";

/**
 * Unit testy pro `CalibrationOutlierDetector` (AP-MCE-001 Fáze G §12,
 * součást 60 scénářů §28).
 */

describe("median (AP-MCE-001 Fáze G §12)", () => {
  it("1. medián sudého i lichého pole", () => {
    expect(median([1, 2, 3])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBe(0);
  });
});

describe("detectCalibrationOutliers (AP-MCE-001 Fáze G §12)", () => {
  it("2. hodnoty v očekávaném rozsahu jsou 'accepted'", () => {
    const values = [10, 11, 9, 10, 12, 9, 11, 10];
    const result = detectCalibrationOutliers({ values });
    expect(result.items.every((i) => i.status === "accepted")).toBe(true);
  });

  it("3. hodnota mimo IQR rozsah je 'suspected', ne automaticky vyřazena", () => {
    const values = [10, 11, 9, 10, 12, 9, 11, 10, 200];
    const result = detectCalibrationOutliers({ values, extremePercentageThreshold: 1000 });
    const outlier = result.items.find((i) => i.value === 200)!;
    expect(outlier.status).toBe("suspected");
    expect(outlier.method).toBe("iqr");
  });

  it("4. explicitní tenant limit MÁ PŘEDNOST a vede k 'excluded' (ne jen 'suspected')", () => {
    const values = [10, 11, 9, 10, 250];
    const result = detectCalibrationOutliers({ values, explicitTenantLimitPercent: 100 });
    const outlier = result.items.find((i) => i.value === 250)!;
    expect(outlier.status).toBe("excluded");
    expect(outlier.method).toBe("explicit_limit");
  });

  it("5. hodnota nad extrémním procentuálním prahem je 'suspected' metodou 'extreme_percentage'", () => {
    const values = [10, 11, 9, 10, 150];
    const result = detectCalibrationOutliers({ values, extremePercentageThreshold: 100 });
    const outlier = result.items.find((i) => i.value === 150)!;
    expect(outlier.status).toBe("suspected");
    expect(outlier.method).toBe("extreme_percentage");
  });

  it("6. dataset pod minimální velikostí vzorku nastaví insufficientSampleSize: true", () => {
    const result = detectCalibrationOutliers({ values: [10, 20], minimumSampleSize: 5 });
    expect(result.insufficientSampleSize).toBe(true);
  });
});
