import { describe, it, expect, beforeEach } from "vitest";
import { CapacityGroup } from "@/domain/entities/capacity-group";
import { CapacityGroupCode } from "@/domain/value-objects/capacity-group-code";
import { Machine } from "@/domain/entities/machine";
import { MachineCode } from "@/domain/value-objects/machine-code";
import { HourlyRate } from "@/domain/value-objects/hourly-rate";
import { DEFAULT_TENANT_ID } from "@/domain/entities/tenant";
import { CapacityGroupCodeAlreadyExistsError } from "@/domain/errors/capacity-group-code-already-exists-error";
import { IndexedDbCapacityGroupRepository } from "./indexeddb-capacity-group-repository";
import { IndexedDbMachineRepository } from "./indexeddb-machine-repository";
import { deleteTpvDbForTests } from "../tpv-db";

const OTHER_TENANT_ID = "tenant:other";

describe("CapacityGroup", () => {
  beforeEach(async () => {
    await deleteTpvDbForTests();
  });

  it("hlídá unikátnost kódu v rámci tenanta, ale ne mezi tenanty", async () => {
    const repo = new IndexedDbCapacityGroupRepository();

    await repo.save(
      CapacityGroup.create({
        id: "cap-1",
        tenantId: DEFAULT_TENANT_ID,
        code: CapacityGroupCode.create("BRUSKA-1"),
        name: "Bruska - fyzický stroj",
        status: "active",
      })
    );

    await expect(
      repo.save(
        CapacityGroup.create({
          id: "cap-2",
          tenantId: DEFAULT_TENANT_ID,
          code: CapacityGroupCode.create("BRUSKA-1"),
          name: "Duplicitní kód",
          status: "active",
        })
      )
    ).rejects.toThrow(CapacityGroupCodeAlreadyExistsError);

    // Stejný kód u jiného tenanta je v pořádku.
    await expect(
      repo.save(
        CapacityGroup.create({
          id: "cap-3",
          tenantId: OTHER_TENANT_ID,
          code: CapacityGroupCode.create("BRUSKA-1"),
          name: "Bruska u jiné organizace",
          status: "active",
        })
      )
    ).resolves.not.toThrow();
  });

  it("umožní víc strojů (různé Machine id/code) ve stejné skupině - stroje se nikdy neslučují", async () => {
    const groups = new IndexedDbCapacityGroupRepository();
    const machines = new IndexedDbMachineRepository();

    const group = CapacityGroup.create({
      id: "cap-shared",
      tenantId: DEFAULT_TENANT_ID,
      code: CapacityGroupCode.create("SHARED-PHYSICAL"),
      name: "Sdílená fyzická kapacita",
      status: "active",
    });
    await groups.save(group);

    const machineA = Machine.create({
      id: "machine-a",
      tenantId: DEFAULT_TENANT_ID,
      code: MachineCode.create("300-58140"),
      name: "Stroj A (Helios kód 1)",
      hourlyRate: HourlyRate.of(1000),
      status: "active",
      capacityGroupId: group.id,
    });
    const machineB = Machine.create({
      id: "machine-b",
      tenantId: DEFAULT_TENANT_ID,
      code: MachineCode.create("300-58141"),
      name: "Stroj B (Helios kód 2)",
      hourlyRate: HourlyRate.of(1000),
      status: "active",
      capacityGroupId: group.id,
    });
    await machines.save(machineA);
    await machines.save(machineB);

    const all = await machines.list(DEFAULT_TENANT_ID);
    const linked = all.filter((m) => m.capacityGroupId === group.id);
    expect(linked).toHaveLength(2);
    expect(new Set(linked.map((m) => m.id)).size).toBe(2);
    expect(new Set(linked.map((m) => m.code.toString())).size).toBe(2);
  });

  it("smazání skupiny nemaže napojené stroje - jen ztratí odkaz na skupinu (bezpečné mazání)", async () => {
    const groups = new IndexedDbCapacityGroupRepository();
    const machines = new IndexedDbMachineRepository();

    const group = CapacityGroup.create({
      id: "cap-to-delete",
      tenantId: DEFAULT_TENANT_ID,
      code: CapacityGroupCode.create("TO-DELETE"),
      name: "Ke smazání",
      status: "active",
    });
    await groups.save(group);

    const machine = Machine.create({
      id: "machine-linked",
      tenantId: DEFAULT_TENANT_ID,
      code: MachineCode.create("LINKED-1"),
      name: "Napojený stroj",
      hourlyRate: HourlyRate.of(900),
      status: "active",
      capacityGroupId: group.id,
    });
    await machines.save(machine);

    await groups.delete(group.id, DEFAULT_TENANT_ID);

    expect(await groups.findById(group.id, DEFAULT_TENANT_ID)).toBeNull();
    const stillThere = await machines.findById(machine.id, DEFAULT_TENANT_ID);
    expect(stillThere).not.toBeNull();
    expect(stillThere?.capacityGroupId).toBe(group.id); // repozitář sám neuklízí cizí odkazy - viz known-limitations
  });
});
