import { describe, it, expect } from "vitest";
import { DevelopmentLicenseProvider } from "./development-license-provider";
import { LicenseProvider } from "@/domain/licensing/license-provider";
import { License } from "@/domain/licensing/license";
import { FeatureCodes } from "@/domain/licensing/feature-code";

const TENANT_ID = "tenant:test";

function restrictiveLicense(): License {
  return License.create({
    id: "license:restrictive",
    tenantId: TENANT_ID,
    planCode: "restrictive",
    status: "active",
    validFrom: new Date(0).toISOString(),
    features: [{ code: FeatureCodes.RoutingView, access: "read" }],
    limits: [{ code: "machines.max", value: 1 }],
    issuedAt: new Date(0).toISOString(),
  });
}

function fallbackProvider(license: License): LicenseProvider {
  return { getCurrentLicense: async () => license };
}

describe("DevelopmentLicenseProvider", () => {
  it("mimo vývojové prostředí je průhledný passthrough - NIKDY nerozšíří přístup", async () => {
    const base = restrictiveLicense();
    const provider = new DevelopmentLicenseProvider(fallbackProvider(base), () => false);

    const license = await provider.getCurrentLicense();
    expect(license.getFeatureAccess(FeatureCodes.MachinesManage)).toBeUndefined();
    expect(license.getFeatureAccess(FeatureCodes.RoutingView)).toBe("read");
  });

  it("ve vývojovém prostředí rozšíří licenci na plný přístup ke všem FeatureCode", async () => {
    const base = restrictiveLicense();
    const provider = new DevelopmentLicenseProvider(fallbackProvider(base), () => true);

    const license = await provider.getCurrentLicense();
    expect(license.getFeatureAccess(FeatureCodes.MachinesManage)).toBe("full");
    expect(license.getFeatureAccess(FeatureCodes.IntegrationHeliosSync)).toBe("full");
  });

  it("bezpečný výchozí stav bez explicitního přepsání čte process.env.NODE_ENV, ne 'development' natvrdo", async () => {
    const env = process.env as Record<string, string | undefined>;
    const originalEnv = env.NODE_ENV;
    try {
      env.NODE_ENV = "production";
      const base = restrictiveLicense();
      const provider = new DevelopmentLicenseProvider(fallbackProvider(base));
      const license = await provider.getCurrentLicense();
      expect(license.getFeatureAccess(FeatureCodes.MachinesManage)).toBeUndefined();
    } finally {
      env.NODE_ENV = originalEnv;
    }
  });

  it("nemění tenantId/id/planCode/limity základní licence - jen features", async () => {
    const base = restrictiveLicense();
    const provider = new DevelopmentLicenseProvider(fallbackProvider(base), () => true);
    const license = await provider.getCurrentLicense();
    expect(license.id).toBe(base.id);
    expect(license.tenantId).toBe(base.tenantId);
    expect(license.planCode).toBe(base.planCode);
    expect(license.getLimit("machines.max")).toBe(1);
  });
});
