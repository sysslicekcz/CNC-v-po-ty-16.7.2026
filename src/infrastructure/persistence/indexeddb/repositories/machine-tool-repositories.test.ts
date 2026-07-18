import { describe, it, expect, beforeEach } from "vitest";
import { Machine } from "@/domain/entities/machine";
import { MachineCapability } from "@/domain/entities/machine-capability";
import { Tool } from "@/domain/entities/tool";
import { ToolMachineCondition } from "@/domain/entities/tool-machine-condition";
import { HourlyRate } from "@/domain/value-objects/hourly-rate";
import { CuttingParameters } from "@/domain/value-objects/cutting-parameters";
import { IndexedDbMachineRepository } from "./indexeddb-machine-repository";
import { IndexedDbMachineCapabilityRepository } from "./indexeddb-machine-capability-repository";
import { IndexedDbToolRepository } from "./indexeddb-tool-repository";
import { IndexedDbToolMachineConditionRepository } from "./indexeddb-tool-machine-condition-repository";
import { deleteTpvDbForTests } from "../tpv-db";

describe("Machine + MachineCapability repositories", () => {
  beforeEach(async () => {
    await deleteTpvDbForTests();
  });

  it("uloží stroj a jeho capability, dotáže se podle machineId", async () => {
    const machineRepo = new IndexedDbMachineRepository();
    const capabilityRepo = new IndexedDbMachineCapabilityRepository();

    const machine = Machine.create({
      id: "machine-1",
      nazev: "PUMA 700",
      hourlyRate: HourlyRate.of(1200),
      stav: "aktivni",
    });
    await machineRepo.save(machine);

    await capabilityRepo.save(
      MachineCapability.create({ id: "cap-1", machineId: "machine-1", operationTypeId: "turning", enabled: true })
    );
    await capabilityRepo.save(
      MachineCapability.create({ id: "cap-2", machineId: "machine-1", operationTypeId: "milling", enabled: false })
    );

    const found = await machineRepo.findById("machine-1");
    expect(found?.hourlyRate.amount).toBe(1200);
    expect(found?.hourlyRate.currency).toBe("CZK");

    const capabilities = await capabilityRepo.findByMachineId("machine-1");
    expect(capabilities).toHaveLength(2);
    expect(capabilities.find((c) => c.operationTypeId === "milling")?.enabled).toBe(false);
  });
});

describe("Tool + ToolMachineCondition repositories", () => {
  beforeEach(async () => {
    await deleteTpvDbForTests();
  });

  it("uloží nástroj a profily řezných podmínek, dotáže se podle (tool, machine)", async () => {
    const toolRepo = new IndexedDbToolRepository();
    const conditionRepo = new IndexedDbToolMachineConditionRepository();

    const tool = Tool.create({
      id: "tool-1",
      nazev: "Nůž VBD 1",
      toolTypeId: "turning-insert",
      stav: "aktivni",
      defaultCuttingParameters: CuttingParameters.of({ vc: 180, feed: 0.3 }),
    });
    await toolRepo.save(tool);

    await conditionRepo.save(
      ToolMachineCondition.create({
        id: "cond-1",
        toolId: "tool-1",
        machineId: "machine-1",
        parameters: CuttingParameters.of({ vc: 200, feed: 0.25 }),
        stav: "aktivni",
        operationTypeId: "turning",
      })
    );
    await conditionRepo.save(
      ToolMachineCondition.create({
        id: "cond-2",
        toolId: "tool-1",
        machineId: "machine-2",
        parameters: CuttingParameters.of({ vc: 150 }),
        stav: "aktivni",
      })
    );

    const foundTool = await toolRepo.findById("tool-1");
    expect(foundTool?.defaultCuttingParameters?.vc).toBe(180);

    const conditionsForMachine1 = await conditionRepo.findByToolAndMachine("tool-1", "machine-1");
    expect(conditionsForMachine1).toHaveLength(1);
    expect(conditionsForMachine1[0].parameters.vc).toBe(200);

    const conditionsForMachine2 = await conditionRepo.findByToolAndMachine("tool-1", "machine-2");
    expect(conditionsForMachine2).toHaveLength(1);
  });
});
