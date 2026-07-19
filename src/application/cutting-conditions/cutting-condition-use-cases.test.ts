import { describe, it, expect, beforeEach } from "vitest";
import { CreateToolMachineConditionUseCase } from "./create-tool-machine-condition-use-case";
import { UpdateToolMachineConditionUseCase } from "./update-tool-machine-condition-use-case";
import { DeactivateToolMachineConditionUseCase } from "./deactivate-tool-machine-condition-use-case";
import { ResolveCuttingConditionUseCase } from "./resolve-cutting-condition-use-case";
import { CreateToolTypeUseCase } from "@/application/tools/create-tool-type-use-case";
import { CreateToolUseCase } from "@/application/tools/create-tool-use-case";
import { CreateMachineUseCase } from "@/application/machines/create-machine-use-case";
import { CuttingParameters } from "@/domain/value-objects/cutting-parameters";
import { HourlyRate } from "@/domain/value-objects/hourly-rate";
import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCode } from "@/domain/licensing/feature-code";
import { FeatureAccess } from "@/domain/licensing/feature-access";
import { FeatureNotLicensedError } from "@/domain/errors/license-errors";
import { InvalidMasterDataValueError } from "@/domain/errors/master-data-errors";
import { NotFoundError } from "@/domain/errors/not-found-error";
import { IndexedDbToolMachineConditionRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-tool-machine-condition-repository";
import { IndexedDbToolTypeRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-tool-type-repository";
import { IndexedDbToolRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-tool-repository";
import { IndexedDbMachineRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-machine-repository";
import { deleteTpvDbForTests } from "@/infrastructure/persistence/indexeddb/tpv-db";

const TENANT_ID = "tenant:cutting-condition-use-cases";

function tenantContext(): TenantContext {
  return { getCurrentTenantId: () => TENANT_ID, requireCurrentTenantId: () => TENANT_ID };
}

function stubFeatureAccessService(options: { access?: FeatureAccess } = {}): FeatureAccessService {
  const access = options.access ?? "full";
  return {
    getAccess: async () => access,
    canUse: async () => access !== "none",
    require: async (feature: FeatureCode, requiredAccess: FeatureAccess = "read") => {
      if (access === "none") throw new FeatureNotLicensedError(feature);
      const rank: Record<FeatureAccess, number> = { none: 0, read: 1, write: 2, full: 3 };
      if (rank[access] < rank[requiredAccess]) throw new FeatureNotLicensedError(feature);
    },
    getLimit: async () => null,
    assertWithinLimit: async () => {},
  };
}

async function seedToolAndMachine(fas: FeatureAccessService) {
  const toolTypeRepo = new IndexedDbToolTypeRepository();
  const toolRepo = new IndexedDbToolRepository();
  const machineRepo = new IndexedDbMachineRepository();

  const toolType = await new CreateToolTypeUseCase(tenantContext(), toolTypeRepo, fas).execute({ kod: "TT-1", nazev: "Nůž", category: "turning_holder" });
  const tool = await new CreateToolUseCase(tenantContext(), toolRepo, toolTypeRepo, fas).execute({
    nazev: "Nůž VBD",
    toolTypeId: toolType.id,
    defaultCuttingParameters: CuttingParameters.of({ vc: 100, feed: 0.1, ap: 1 }),
  });
  const machine = await new CreateMachineUseCase(tenantContext(), machineRepo, fas).execute({
    code: "M-1",
    name: "Soustruh",
    hourlyRate: HourlyRate.of(1000),
  });
  return { toolRepo, machineRepo, tool, machine };
}

describe("CreateToolMachineConditionUseCase", () => {
  beforeEach(async () => {
    await deleteTpvDbForTests();
  });

  it("založí profil řezných podmínek pro existující nástroj a stroj", async () => {
    const fas = stubFeatureAccessService();
    const { toolRepo, machineRepo, tool, machine } = await seedToolAndMachine(fas);
    const conditionRepo = new IndexedDbToolMachineConditionRepository();

    const condition = await new CreateToolMachineConditionUseCase(tenantContext(), conditionRepo, toolRepo, machineRepo, fas).execute({
      toolId: tool.id,
      machineId: machine.id,
      parameters: CuttingParameters.of({ vc: 180, feed: 0.2, ap: 2 }),
    });
    expect(condition.stav).toBe("aktivni");
  });

  it("vyhodí NotFoundError pro neexistující nástroj/stroj", async () => {
    const fas = stubFeatureAccessService();
    const conditionRepo = new IndexedDbToolMachineConditionRepository();
    const toolRepo = new IndexedDbToolRepository();
    const machineRepo = new IndexedDbMachineRepository();
    await expect(
      new CreateToolMachineConditionUseCase(tenantContext(), conditionRepo, toolRepo, machineRepo, fas).execute({
        toolId: "neexistuje",
        machineId: "neexistuje",
        parameters: CuttingParameters.of({ vc: 180 }),
      })
    ).rejects.toThrow(NotFoundError);
  });

  it("zamítne zápornou prioritu", async () => {
    const fas = stubFeatureAccessService();
    const { toolRepo, machineRepo, tool, machine } = await seedToolAndMachine(fas);
    const conditionRepo = new IndexedDbToolMachineConditionRepository();
    await expect(
      new CreateToolMachineConditionUseCase(tenantContext(), conditionRepo, toolRepo, machineRepo, fas).execute({
        toolId: tool.id,
        machineId: machine.id,
        parameters: CuttingParameters.of({ vc: 180 }),
        priority: -1,
      })
    ).rejects.toThrow(InvalidMasterDataValueError);
  });
});

describe("ResolveCuttingConditionUseCase - specificita profilu", () => {
  beforeEach(async () => {
    await deleteTpvDbForTests();
  });

  it("upřednostní profil se shodou operationTypeId PŘED obecným profilem beze shody", async () => {
    const fas = stubFeatureAccessService();
    const { toolRepo, machineRepo, tool, machine } = await seedToolAndMachine(fas);
    const conditionRepo = new IndexedDbToolMachineConditionRepository();
    const create = new CreateToolMachineConditionUseCase(tenantContext(), conditionRepo, toolRepo, machineRepo, fas);

    await create.execute({ toolId: tool.id, machineId: machine.id, parameters: CuttingParameters.of({ vc: 150 }) });
    await create.execute({
      toolId: tool.id,
      machineId: machine.id,
      operationTypeId: "op-turning",
      parameters: CuttingParameters.of({ vc: 200 }),
    });

    const resolved = await new ResolveCuttingConditionUseCase(tenantContext(), toolRepo, conditionRepo, fas).execute({
      toolId: tool.id,
      machineId: machine.id,
      operationTypeId: "op-turning",
    });
    expect(resolved?.vc).toBe(200);
  });

  it("bez žádného profilu spadne na Tool.defaultCuttingParameters", async () => {
    const fas = stubFeatureAccessService();
    const { toolRepo, tool, machine } = await seedToolAndMachine(fas);
    const conditionRepo = new IndexedDbToolMachineConditionRepository();

    const resolved = await new ResolveCuttingConditionUseCase(tenantContext(), toolRepo, conditionRepo, fas).execute({
      toolId: tool.id,
      machineId: machine.id,
    });
    expect(resolved?.vc).toBe(100);
  });

  it("neaktivní profil se do výběru NEZAPOČÍTÁ", async () => {
    const fas = stubFeatureAccessService();
    const { toolRepo, machineRepo, tool, machine } = await seedToolAndMachine(fas);
    const conditionRepo = new IndexedDbToolMachineConditionRepository();
    const created = await new CreateToolMachineConditionUseCase(tenantContext(), conditionRepo, toolRepo, machineRepo, fas).execute({
      toolId: tool.id,
      machineId: machine.id,
      parameters: CuttingParameters.of({ vc: 999 }),
    });
    await new DeactivateToolMachineConditionUseCase(tenantContext(), conditionRepo, fas).execute(created.id);

    const resolved = await new ResolveCuttingConditionUseCase(tenantContext(), toolRepo, conditionRepo, fas).execute({
      toolId: tool.id,
      machineId: machine.id,
    });
    // Spadne zpět na Tool.defaultCuttingParameters (vc: 100), ne na deaktivovaný profil (999).
    expect(resolved?.vc).toBe(100);
  });
});

describe("UpdateToolMachineConditionUseCase", () => {
  beforeEach(async () => {
    await deleteTpvDbForTests();
  });

  it("aktualizuje parametry beze změny id", async () => {
    const fas = stubFeatureAccessService();
    const { toolRepo, machineRepo, tool, machine } = await seedToolAndMachine(fas);
    const conditionRepo = new IndexedDbToolMachineConditionRepository();
    const created = await new CreateToolMachineConditionUseCase(tenantContext(), conditionRepo, toolRepo, machineRepo, fas).execute({
      toolId: tool.id,
      machineId: machine.id,
      parameters: CuttingParameters.of({ vc: 100 }),
    });

    const updated = await new UpdateToolMachineConditionUseCase(tenantContext(), conditionRepo, fas).execute(created.id, {
      parameters: CuttingParameters.of({ vc: 250 }),
    });
    expect(updated.id).toBe(created.id);
    expect(updated.parameters.vc).toBe(250);
  });
});
