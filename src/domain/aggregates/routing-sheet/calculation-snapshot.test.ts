import { describe, it, expect } from "vitest";
import { Calculation } from "./calculation";
import { Machine } from "../../entities/machine";
import { MachineCode } from "../../value-objects/machine-code";
import { HourlyRate } from "../../value-objects/hourly-rate";
import { DEFAULT_TENANT_ID } from "../../entities/tenant";

function buildCalculationFromMachine(machine: Machine): Calculation {
  return Calculation.create({
    id: "calc-1",
    inputParameters: [{ delka: 100 }],
    result: { rows: [{ label: "Soustružení", kontura: "vnější", cas: 12.5 }], total: 12.5 },
    algorithmVersion: "legacy-v1",
    snapshot: {
      machineId: machine.id,
      machineCode: machine.code.toString(),
      machineName: machine.name,
      machineHourlyRate: machine.hourlyRate.toJSON(),
      operationTypeId: "turning",
      operationTypeCode: "soustruzeni",
      calculatedAt: new Date(0).toISOString(),
      calculationEngineVersion: "legacy-v1",
    },
  });
}

describe("CalculationSnapshot - zamrzlá kopie identity/ceny stroje", () => {
  it("zachytí machineId, machineCode, machineName a hodinovou sazbu v okamžiku výpočtu", () => {
    const machine = Machine.create({
      id: "machine-1",
      tenantId: DEFAULT_TENANT_ID,
      code: MachineCode.create("PUMA-700"),
      name: "PUMA 700",
      hourlyRate: HourlyRate.of(1200),
      status: "active",
    });

    const calculation = buildCalculationFromMachine(machine);

    expect(calculation.snapshot.machineId).toBe("machine-1");
    expect(calculation.snapshot.machineCode).toBe("PUMA-700");
    expect(calculation.snapshot.machineName).toBe("PUMA 700");
    expect(calculation.snapshot.machineHourlyRate).toEqual({ amount: 1200, currency: "CZK" });
  });

  it("pozdější přejmenování/přecenění/změna kódu Machine nezmění existující snapshot", () => {
    const machine = Machine.create({
      id: "machine-1",
      tenantId: DEFAULT_TENANT_ID,
      code: MachineCode.create("PUMA-700"),
      name: "PUMA 700",
      hourlyRate: HourlyRate.of(1200),
      status: "active",
    });

    const calculation = buildCalculationFromMachine(machine);

    machine.rename("PUMA 700 (repas)");
    machine.changeCode(MachineCode.create("PUMA-700-NEW"));
    machine.setHourlyRate(HourlyRate.of(1500));

    expect(calculation.snapshot.machineName).toBe("PUMA 700");
    expect(calculation.snapshot.machineCode).toBe("PUMA-700");
    expect(calculation.snapshot.machineHourlyRate).toEqual({ amount: 1200, currency: "CZK" });
  });

  it("snapshot je zmrazený - přímý pokus o mutaci reference selže/neprojeví se", () => {
    const machine = Machine.create({
      id: "machine-1",
      tenantId: DEFAULT_TENANT_ID,
      code: MachineCode.create("PUMA-700"),
      name: "PUMA 700",
      hourlyRate: HourlyRate.of(1200),
      status: "active",
    });
    const calculation = buildCalculationFromMachine(machine);

    expect(Object.isFrozen(calculation.snapshot)).toBe(true);
    expect(() => {
      (calculation.snapshot as { machineName?: string }).machineName = "Přepsáno zvenku";
    }).toThrow(TypeError);
    expect(calculation.snapshot.machineName).toBe("PUMA 700");
  });
});
