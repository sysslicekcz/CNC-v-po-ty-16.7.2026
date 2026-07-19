import { describe, it, expect, beforeEach } from "vitest";
import { Machine } from "@/domain/entities/machine";
import { MachineCapability } from "@/domain/entities/machine-capability";
import { Tool } from "@/domain/entities/tool";
import { ToolMachineCondition } from "@/domain/entities/tool-machine-condition";
import { HourlyRate } from "@/domain/value-objects/hourly-rate";
import { MachineCode } from "@/domain/value-objects/machine-code";
import { CuttingParameters } from "@/domain/value-objects/cutting-parameters";
import { DEFAULT_TENANT_ID } from "@/domain/entities/tenant";
import { MachineCodeAlreadyExistsError } from "@/domain/errors/machine-code-already-exists-error";
import { IndexedDbMachineRepository } from "./indexeddb-machine-repository";
import { IndexedDbMachineCapabilityRepository } from "./indexeddb-machine-capability-repository";
import { IndexedDbToolRepository } from "./indexeddb-tool-repository";
import { IndexedDbToolMachineConditionRepository } from "./indexeddb-tool-machine-condition-repository";
import { deleteTpvDbForTests } from "../tpv-db";

const OTHER_TENANT_ID = "tenant:other";

describe("Machine + MachineCapability repositories", () => {
  beforeEach(async () => {
    await deleteTpvDbForTests();
  });

  it("uloží stroj a jeho capability, dotáže se podle machineId", async () => {
    const machineRepo = new IndexedDbMachineRepository();
    const capabilityRepo = new IndexedDbMachineCapabilityRepository();

    const machine = Machine.create({
      id: "machine-1",
      tenantId: DEFAULT_TENANT_ID,
      code: MachineCode.create("PUMA-700"),
      name: "PUMA 700",
      hourlyRate: HourlyRate.of(1200),
      status: "active",
    });
    await machineRepo.save(machine);

    await capabilityRepo.save(
      MachineCapability.create({
        id: "cap-1",
        tenantId: DEFAULT_TENANT_ID,
        machineId: "machine-1",
        operationTypeId: "turning",
        enabled: true,
      })
    );
    await capabilityRepo.save(
      MachineCapability.create({
        id: "cap-2",
        tenantId: DEFAULT_TENANT_ID,
        machineId: "machine-1",
        operationTypeId: "milling",
        enabled: false,
      })
    );

    const found = await machineRepo.findById("machine-1", DEFAULT_TENANT_ID);
    expect(found?.hourlyRate.amount).toBe(1200);
    expect(found?.hourlyRate.currency).toBe("CZK");
    expect(found?.code.toString()).toBe("PUMA-700");

    const capabilities = await capabilityRepo.findByMachineId("machine-1", DEFAULT_TENANT_ID);
    expect(capabilities).toHaveLength(2);
    expect(capabilities.find((c) => c.operationTypeId === "milling")?.enabled).toBe(false);
  });

  it("izoluje stroje mezi tenanty - cizí tenant stroj nevidí", async () => {
    const machineRepo = new IndexedDbMachineRepository();

    await machineRepo.save(
      Machine.create({
        id: "machine-tenant-a",
        tenantId: DEFAULT_TENANT_ID,
        code: MachineCode.create("A-100"),
        name: "Stroj A",
        hourlyRate: HourlyRate.of(1000),
        status: "active",
      })
    );

    expect(await machineRepo.findById("machine-tenant-a", OTHER_TENANT_ID)).toBeNull();
    expect(await machineRepo.findByCode(OTHER_TENANT_ID, MachineCode.create("A-100"))).toBeNull();
    expect(await machineRepo.list(OTHER_TENANT_ID)).toHaveLength(0);
    expect(await machineRepo.list(DEFAULT_TENANT_ID)).toHaveLength(1);
  });

  it("dovolí stejný kód u dvou různých tenantů, ale ne dvakrát u stejného tenanta", async () => {
    const machineRepo = new IndexedDbMachineRepository();

    await machineRepo.save(
      Machine.create({
        id: "machine-1",
        tenantId: DEFAULT_TENANT_ID,
        code: MachineCode.create("SHARED-CODE"),
        name: "Stroj 1",
        hourlyRate: HourlyRate.of(1000),
        status: "active",
      })
    );
    await machineRepo.save(
      Machine.create({
        id: "machine-2",
        tenantId: OTHER_TENANT_ID,
        code: MachineCode.create("SHARED-CODE"),
        name: "Stroj 2",
        hourlyRate: HourlyRate.of(900),
        status: "active",
      })
    );

    await expect(
      machineRepo.save(
        Machine.create({
          id: "machine-3",
          tenantId: DEFAULT_TENANT_ID,
          code: MachineCode.create("SHARED-CODE"),
          name: "Stroj 3",
          hourlyRate: HourlyRate.of(800),
          status: "active",
        })
      )
    ).rejects.toThrow(MachineCodeAlreadyExistsError);
  });

  it("zachová id a code stabilní přes rename", async () => {
    const machineRepo = new IndexedDbMachineRepository();

    const machine = Machine.create({
      id: "machine-1",
      tenantId: DEFAULT_TENANT_ID,
      code: MachineCode.create("PUMA-700"),
      name: "PUMA 700",
      hourlyRate: HourlyRate.of(1200),
      status: "active",
    });
    await machineRepo.save(machine);

    machine.rename("PUMA 700 (repas)");
    await machineRepo.save(machine);

    const found = await machineRepo.findById("machine-1", DEFAULT_TENANT_ID);
    expect(found?.id).toBe("machine-1");
    expect(found?.code.toString()).toBe("PUMA-700");
    expect(found?.name).toBe("PUMA 700 (repas)");
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
      tenantId: DEFAULT_TENANT_ID,
      nazev: "Nůž VBD 1",
      toolTypeId: "turning-insert",
      stav: "aktivni",
      defaultCuttingParameters: CuttingParameters.of({ vc: 180, feed: 0.3 }),
    });
    await toolRepo.save(tool);

    await conditionRepo.save(
      ToolMachineCondition.create({
        id: "cond-1",
        tenantId: DEFAULT_TENANT_ID,
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
        tenantId: DEFAULT_TENANT_ID,
        toolId: "tool-1",
        machineId: "machine-2",
        parameters: CuttingParameters.of({ vc: 150 }),
        stav: "aktivni",
      })
    );

    const foundTool = await toolRepo.findById("tool-1", DEFAULT_TENANT_ID);
    expect(foundTool?.defaultCuttingParameters?.vc).toBe(180);

    const conditionsForMachine1 = await conditionRepo.findByToolAndMachine("tool-1", "machine-1", DEFAULT_TENANT_ID);
    expect(conditionsForMachine1).toHaveLength(1);
    expect(conditionsForMachine1[0].parameters.vc).toBe(200);

    const conditionsForMachine2 = await conditionRepo.findByToolAndMachine("tool-1", "machine-2", DEFAULT_TENANT_ID);
    expect(conditionsForMachine2).toHaveLength(1);
  });
});
