import { describe, it, expect } from "vitest";
import { ValidationError } from "@/domain/errors/validation-error";
import { VarianceToleranceProfile, VarianceToleranceProfileProps, systemDefaultToleranceProfile, resolveVarianceToleranceProfile } from "./variance-tolerance-profile";

/**
 * Unit testy pro `VarianceToleranceProfile`/priorita resolveru (AP-MCE-001
 * Fáze G §9, součást 60 scénářů §28).
 */

const NOW = "2025-06-01T00:00:00.000Z";
const TENANT_ID = "tenant:acme";

function props(overrides: Partial<VarianceToleranceProfileProps> = {}): VarianceToleranceProfileProps {
  return {
    id: "vtp:1",
    tenantId: TENANT_ID,
    metric: "total_time",
    negligiblePercent: 5,
    lowPercent: 10,
    mediumPercent: 20,
    highPercent: 35,
    criticalPercent: 60,
    absoluteMinimumToleranceMin: 1,
    recordVersion: 1,
    validFrom: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("VarianceToleranceProfile (AP-MCE-001 Fáze G §9)", () => {
  it("1. neklesající prahy projdou validací bez chyb", () => {
    expect(() => VarianceToleranceProfile.create(props())).not.toThrow();
  });

  it("2. klesající prahy (medium < low) vyhodí ValidationError", () => {
    expect(() => VarianceToleranceProfile.create(props({ lowPercent: 15, mediumPercent: 10 }))).toThrow(ValidationError);
  });

  it("3. systemDefaultToleranceProfile vrátí platný profil pro libovolnou metriku", () => {
    const profile = systemDefaultToleranceProfile("setup");
    expect(profile.metric).toBe("setup");
    expect(profile.isValidAt(NOW)).toBe(true);
  });

  it("4. resolveVarianceToleranceProfile respektuje prioritu site+subtype > category > tenant default > system default", () => {
    const siteSubtype = VarianceToleranceProfile.create(props({ id: "site-subtype", siteId: "site:1", operationSubtype: "od-rovna", negligiblePercent: 1, lowPercent: 2, mediumPercent: 3, highPercent: 4, criticalPercent: 5 }));
    const category = VarianceToleranceProfile.create(props({ id: "category", operationCategory: "turning" }));
    const tenantDefault = VarianceToleranceProfile.create(props({ id: "tenant-default" }));

    const resolvedSiteSubtype = resolveVarianceToleranceProfile({
      candidates: [siteSubtype, category, tenantDefault],
      tenantId: TENANT_ID,
      siteId: "site:1",
      operationCategory: "turning",
      operationSubtype: "od-rovna",
      metric: "total_time",
      now: NOW,
    });
    expect(resolvedSiteSubtype.id).toBe("site-subtype");

    const resolvedCategory = resolveVarianceToleranceProfile({
      candidates: [category, tenantDefault],
      tenantId: TENANT_ID,
      operationCategory: "turning",
      metric: "total_time",
      now: NOW,
    });
    expect(resolvedCategory.id).toBe("category");

    const resolvedTenantDefault = resolveVarianceToleranceProfile({
      candidates: [tenantDefault],
      tenantId: TENANT_ID,
      operationCategory: "milling",
      metric: "total_time",
      now: NOW,
    });
    expect(resolvedTenantDefault.id).toBe("tenant-default");

    const resolvedSystemDefault = resolveVarianceToleranceProfile({
      candidates: [],
      tenantId: TENANT_ID,
      operationCategory: "milling",
      metric: "total_time",
      now: NOW,
    });
    expect(resolvedSystemDefault.id).toBe("system-default:total_time");
  });
});
