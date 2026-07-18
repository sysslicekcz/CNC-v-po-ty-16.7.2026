import { describe, it, expect } from "vitest";
import { MachineCode } from "./machine-code";
import { TenantCode } from "./tenant-code";
import { CapacityGroupCode } from "./capacity-group-code";
import { ExternalResourceCode } from "./external-resource-code";
import { ToolCode } from "./tool-code";
import { ValidationError } from "../errors/validation-error";

describe("MachineCode", () => {
  it("odmítne prázdný a jen-mezerový kód", () => {
    expect(() => MachineCode.create("")).toThrow(ValidationError);
    expect(() => MachineCode.create("   ")).toThrow(ValidationError);
  });

  it("ořízne okolní mezery, ale zachová vnitřní strukturu a velikost písmen", () => {
    expect(MachineCode.create("  300-58140  ").toString()).toBe("300-58140");
    expect(MachineCode.create("KOOP-TEP").toString()).toBe("KOOP-TEP");
  });

  it("nenormalizuje velikost písmen - 'sp-430' a 'SP-430' jsou různé kódy", () => {
    const lower = MachineCode.create("sp-430");
    const upper = MachineCode.create("SP-430");
    expect(lower.equals(upper)).toBe(false);
  });

  it("equals porovnává podle hodnoty, ne reference", () => {
    expect(MachineCode.create("DNM750").equals(MachineCode.create("DNM750"))).toBe(true);
  });

  it("toJSON/fromJSON round-trip", () => {
    const code = MachineCode.create("PUMA-700");
    expect(MachineCode.fromJSON(code.toJSON()).equals(code)).toBe(true);
  });
});

describe("TenantCode / CapacityGroupCode / ExternalResourceCode / ToolCode", () => {
  it("všechny odmítnou prázdnou hodnotu", () => {
    expect(() => TenantCode.create("")).toThrow(ValidationError);
    expect(() => CapacityGroupCode.create("")).toThrow(ValidationError);
    expect(() => ExternalResourceCode.create("")).toThrow(ValidationError);
    expect(() => ToolCode.create("")).toThrow(ValidationError);
  });

  it("všechny ořežou okolní mezery a zachovají hodnotu", () => {
    expect(TenantCode.create("  LOCAL-DEFAULT  ").toString()).toBe("LOCAL-DEFAULT");
    expect(CapacityGroupCode.create(" CAP-1 ").toString()).toBe("CAP-1");
    expect(ExternalResourceCode.create(" KALIRNA ").toString()).toBe("KALIRNA");
    expect(ToolCode.create(" T-001 ").toString()).toBe("T-001");
  });
});
