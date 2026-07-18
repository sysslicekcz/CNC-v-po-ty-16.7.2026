import { describe, it, expect } from "vitest";
import { resolveFeatureGateState } from "./feature-gate-logic";
import { FeatureAccessSnapshot } from "@/application/licensing/feature-access-snapshot";
import { FeatureCode, FeatureCodes } from "@/domain/licensing/feature-code";
import { FeatureAccess } from "@/domain/licensing/feature-access";

function snapshotWith(access: Partial<Record<FeatureCode, FeatureAccess>>, licenseError?: string): FeatureAccessSnapshot {
  return {
    tenantId: "tenant:test",
    tenantActive: true,
    access: access as Record<FeatureCode, FeatureAccess>,
    licenseError,
  };
}

describe("resolveFeatureGateState", () => {
  it("vrátí 'loading', dokud snapshot ještě není načtený", () => {
    expect(resolveFeatureGateState(null, FeatureCodes.MachinesManage)).toBe("loading");
  });

  it("vrátí 'error', pokud snapshot obsahuje licenseError - i kdyby access náhodou vypadal dostatečně", () => {
    const snapshot = snapshotWith({ [FeatureCodes.MachinesManage]: "full" }, "Licence organizace vypršela.");
    expect(resolveFeatureGateState(snapshot, FeatureCodes.MachinesManage, "write")).toBe("error");
  });

  it("vrátí 'granted', když úroveň přístupu funkci pokrývá", () => {
    const snapshot = snapshotWith({ [FeatureCodes.MachinesManage]: "write" });
    expect(resolveFeatureGateState(snapshot, FeatureCodes.MachinesManage, "write")).toBe("granted");
    expect(resolveFeatureGateState(snapshot, FeatureCodes.MachinesManage, "read")).toBe("granted");
  });

  it("vrátí 'denied', když úroveň přístupu nestačí (read < write)", () => {
    const snapshot = snapshotWith({ [FeatureCodes.MachinesManage]: "read" });
    expect(resolveFeatureGateState(snapshot, FeatureCodes.MachinesManage, "write")).toBe("denied");
  });

  it("vrátí 'denied' pro funkci, která v snapshotu vůbec není uvedená (chybí = 'none')", () => {
    const snapshot = snapshotWith({});
    expect(resolveFeatureGateState(snapshot, FeatureCodes.IntegrationHeliosSync)).toBe("denied");
  });

  it("výchozí requiredAccess je 'read'", () => {
    const snapshot = snapshotWith({ [FeatureCodes.RoutingView]: "read" });
    expect(resolveFeatureGateState(snapshot, FeatureCodes.RoutingView)).toBe("granted");
  });
});
