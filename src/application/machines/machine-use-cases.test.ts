import { describe, it, expect, beforeEach } from "vitest";
import { CreateMachineUseCase } from "./create-machine-use-case";
import { UpdateMachineUseCase } from "./update-machine-use-case";
import { DeactivateMachineUseCase } from "./deactivate-machine-use-case";
import { ResolveMachineByCodeUseCase } from "./resolve-machine-by-code-use-case";
import { HourlyRate } from "@/domain/value-objects/hourly-rate";
import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCode } from "@/domain/licensing/feature-code";
import { FeatureAccess } from "@/domain/licensing/feature-access";
import { LicenseLimitCode } from "@/domain/licensing/license-limit-code";
import { FeatureNotLicensedError } from "@/domain/errors/license-errors";
import { LicenseLimitExceededError } from "@/domain/errors/license-errors";
import { MachineCodeAlreadyExistsError } from "@/domain/errors/machine-code-already-exists-error";
import { UnknownMachineCodeError } from "@/domain/errors/unknown-machine-code-error";
import { NotFoundError } from "@/domain/errors/not-found-error";
import { IndexedDbMachineRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-machine-repository";
import { deleteTpvDbForTests } from "@/infrastructure/persistence/indexeddb/tpv-db";

const TENANT_ID = "tenant:machine-use-cases";

function tenantContext(): TenantContext {
  return { getCurrentTenantId: () => TENANT_ID, requireCurrentTenantId: () => TENANT_ID };
}

/** Jednoduchý stub - žádné napojení na skutečnou licenci, jen řízené
 *  chování pro testy použití v use casech (grant/deny, limit). */
function stubFeatureAccessService(options: {
  access?: FeatureAccess;
  limit?: number | null;
} = {}): FeatureAccessService {
  const access = options.access ?? "full";
  const limit = options.limit === undefined ? null : options.limit;
  return {
    getAccess: async () => access,
    canUse: async () => access !== "none",
    require: async (feature: FeatureCode, requiredAccess: FeatureAccess = "read") => {
      if (access === "none") throw new FeatureNotLicensedError(feature);
      const rank: Record<FeatureAccess, number> = { none: 0, read: 1, write: 2, full: 3 };
      if (rank[access] < rank[requiredAccess]) throw new FeatureNotLicensedError(feature);
    },
    getLimit: async () => limit,
    assertWithinLimit: async (limitCode: LicenseLimitCode, nextValue: number) => {
      if (limit !== null && nextValue > limit) throw new LicenseLimitExceededError(limitCode, limit, nextValue);
    },
  };
}

describe("CreateMachineUseCase", () => {
  beforeEach(async () => {
    await deleteTpvDbForTests();
  });

  it("založí stroj, když licence dovoluje zápis a limit není překročen", async () => {
    const repo = new IndexedDbMachineRepository();
    const useCase = new CreateMachineUseCase(tenantContext(), repo, stubFeatureAccessService());

    const machine = await useCase.execute({ code: "M-1", name: "Stroj 1", hourlyRate: HourlyRate.of(1000) });

    expect(machine.tenantId).toBe(TENANT_ID);
    expect((await repo.findById(machine.id, TENANT_ID))?.code.toString()).toBe("M-1");
  });

  it("zamítne založení, pokud licence funkci 'machines.manage' nepovoluje", async () => {
    const repo = new IndexedDbMachineRepository();
    const useCase = new CreateMachineUseCase(tenantContext(), repo, stubFeatureAccessService({ access: "none" }));

    await expect(
      useCase.execute({ code: "M-1", name: "Stroj 1", hourlyRate: HourlyRate.of(1000) })
    ).rejects.toThrow(FeatureNotLicensedError);
  });

  it("zamítne založení nad licenčním limitem počtu strojů", async () => {
    const repo = new IndexedDbMachineRepository();
    const useCase = new CreateMachineUseCase(tenantContext(), repo, stubFeatureAccessService({ limit: 1 }));

    await useCase.execute({ code: "M-1", name: "Stroj 1", hourlyRate: HourlyRate.of(1000) });
    await expect(
      useCase.execute({ code: "M-2", name: "Stroj 2", hourlyRate: HourlyRate.of(1000) })
    ).rejects.toThrow(LicenseLimitExceededError);
  });

  it("zamítne založení s kódem, který v tenantovi už existuje", async () => {
    const repo = new IndexedDbMachineRepository();
    const useCase = new CreateMachineUseCase(tenantContext(), repo, stubFeatureAccessService());

    await useCase.execute({ code: "DUP", name: "Stroj 1", hourlyRate: HourlyRate.of(1000) });
    await expect(
      useCase.execute({ code: "DUP", name: "Stroj 2", hourlyRate: HourlyRate.of(1000) })
    ).rejects.toThrow(MachineCodeAlreadyExistsError);
  });
});

describe("UpdateMachineUseCase", () => {
  beforeEach(async () => {
    await deleteTpvDbForTests();
  });

  it("zachová id při přejmenování a změně kódu, re-ověří unikátnost nového kódu", async () => {
    const repo = new IndexedDbMachineRepository();
    const create = new CreateMachineUseCase(tenantContext(), repo, stubFeatureAccessService());
    const update = new UpdateMachineUseCase(tenantContext(), repo, stubFeatureAccessService());

    const machineA = await create.execute({ code: "A-1", name: "Stroj A", hourlyRate: HourlyRate.of(1000) });
    await create.execute({ code: "B-1", name: "Stroj B", hourlyRate: HourlyRate.of(900) });

    const renamed = await update.execute(machineA.id, { name: "Stroj A (repas)" });
    expect(renamed.id).toBe(machineA.id);
    expect(renamed.name).toBe("Stroj A (repas)");

    await expect(update.execute(machineA.id, { code: "B-1" })).rejects.toThrow(MachineCodeAlreadyExistsError);

    const recoded = await update.execute(machineA.id, { code: "A-2" });
    expect(recoded.id).toBe(machineA.id);
    expect(recoded.code.toString()).toBe("A-2");
  });

  it("vyhodí NotFoundError pro neexistující stroj", async () => {
    const repo = new IndexedDbMachineRepository();
    const update = new UpdateMachineUseCase(tenantContext(), repo, stubFeatureAccessService());
    await expect(update.execute("neexistujici-id", { name: "X" })).rejects.toThrow(NotFoundError);
  });
});

describe("DeactivateMachineUseCase", () => {
  beforeEach(async () => {
    await deleteTpvDbForTests();
  });

  it("preferuje deaktivaci před fyzickým smazáním - stroj po deaktivaci pořád existuje", async () => {
    const repo = new IndexedDbMachineRepository();
    const create = new CreateMachineUseCase(tenantContext(), repo, stubFeatureAccessService());
    const deactivate = new DeactivateMachineUseCase(tenantContext(), repo, stubFeatureAccessService());

    const machine = await create.execute({ code: "M-1", name: "Stroj 1", hourlyRate: HourlyRate.of(1000) });
    await deactivate.execute(machine.id);

    const found = await repo.findById(machine.id, TENANT_ID);
    expect(found).not.toBeNull();
    expect(found?.status).toBe("inactive");
  });
});

describe("ResolveMachineByCodeUseCase", () => {
  beforeEach(async () => {
    await deleteTpvDbForTests();
  });

  it("najde stroj podle kódu", async () => {
    const repo = new IndexedDbMachineRepository();
    const create = new CreateMachineUseCase(tenantContext(), repo, stubFeatureAccessService());
    await create.execute({ code: "HELIOS-1", name: "Stroj 1", hourlyRate: HourlyRate.of(1000) });

    const resolve = new ResolveMachineByCodeUseCase(tenantContext(), repo);
    const found = await resolve.execute("HELIOS-1");
    expect(found.name).toBe("Stroj 1");
  });

  it("NIKDY automaticky nevytvoří stroj pro neznámý kód - vyhodí UnknownMachineCodeError", async () => {
    const repo = new IndexedDbMachineRepository();
    const resolve = new ResolveMachineByCodeUseCase(tenantContext(), repo);
    await expect(resolve.execute("NEEXISTUJE")).rejects.toThrow(UnknownMachineCodeError);
    expect(await repo.count(TENANT_ID)).toBe(0);
  });
});
