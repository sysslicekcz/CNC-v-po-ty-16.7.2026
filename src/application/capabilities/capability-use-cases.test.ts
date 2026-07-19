import { describe, it, expect, beforeEach } from "vitest";
import { CreateCapabilityTypeUseCase } from "./create-capability-type-use-case";
import { UpdateCapabilityTypeUseCase } from "./update-capability-type-use-case";
import { AssignMachineCapabilityValueUseCase } from "./assign-machine-capability-value-use-case";
import { RemoveMachineCapabilityValueUseCase } from "./remove-machine-capability-value-use-case";
import { CreateMachineUseCase } from "@/application/machines/create-machine-use-case";
import { HourlyRate } from "@/domain/value-objects/hourly-rate";
import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCode } from "@/domain/licensing/feature-code";
import { FeatureAccess } from "@/domain/licensing/feature-access";
import { FeatureNotLicensedError } from "@/domain/errors/license-errors";
import { MasterDataCodeAlreadyExistsError, InvalidMasterDataValueError } from "@/domain/errors/master-data-errors";
import { NotFoundError } from "@/domain/errors/not-found-error";
import { ValidationError } from "@/domain/errors/validation-error";
import { IndexedDbCapabilityTypeRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-capability-type-repository";
import { IndexedDbMachineCapabilityValueRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-machine-capability-value-repository";
import { IndexedDbMachineRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-machine-repository";
import { deleteTpvDbForTests } from "@/infrastructure/persistence/indexeddb/tpv-db";

const TENANT_ID = "tenant:capability-use-cases";

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

describe("CreateCapabilityTypeUseCase", () => {
  beforeEach(async () => {
    await deleteTpvDbForTests();
  });

  it("založí capabilitu typu 'number' s jednotkou", async () => {
    const repo = new IndexedDbCapabilityTypeRepository();
    const created = await new CreateCapabilityTypeUseCase(tenantContext(), repo, stubFeatureAccessService()).execute({
      code: "MAX_TURNING_DIAMETER",
      name: "Max. průměr soustružení",
      valueType: "number",
      unit: "mm",
    });
    expect(created.valueType).toBe("number");
  });

  it("'selection' bez allowedValues se odmítne na úrovni entity", async () => {
    const repo = new IndexedDbCapabilityTypeRepository();
    await expect(
      new CreateCapabilityTypeUseCase(tenantContext(), repo, stubFeatureAccessService()).execute({
        code: "COOLANT_TYPE",
        name: "Typ chlazení",
        valueType: "selection",
      })
    ).rejects.toThrow(ValidationError);
  });

  it("zamítne duplicitní kód capability v rámci tenanta", async () => {
    const repo = new IndexedDbCapabilityTypeRepository();
    const create = new CreateCapabilityTypeUseCase(tenantContext(), repo, stubFeatureAccessService());
    await create.execute({ code: "LIVE_TOOLING", name: "Poháněné nástroje", valueType: "boolean" });
    await expect(create.execute({ code: "LIVE_TOOLING", name: "Jiný název", valueType: "boolean" })).rejects.toThrow(MasterDataCodeAlreadyExistsError);
  });
});

describe("AssignMachineCapabilityValueUseCase - validace proti CapabilityType", () => {
  beforeEach(async () => {
    await deleteTpvDbForTests();
  });

  async function seed(fas: FeatureAccessService) {
    const capabilityTypeRepo = new IndexedDbCapabilityTypeRepository();
    const machineRepo = new IndexedDbMachineRepository();
    const valueRepo = new IndexedDbMachineCapabilityValueRepository();

    const capabilityType = await new CreateCapabilityTypeUseCase(tenantContext(), capabilityTypeRepo, fas).execute({
      code: "MAX_TURNING_DIAMETER",
      name: "Max. průměr soustružení",
      valueType: "number",
      unit: "mm",
    });
    const machine = await new CreateMachineUseCase(tenantContext(), machineRepo, fas).execute({
      code: "M-1",
      name: "Soustruh",
      hourlyRate: HourlyRate.of(1000),
    });
    return { capabilityTypeRepo, machineRepo, valueRepo, capabilityType, machine };
  }

  it("založí hodnotu, druhé volání ji jen přepíše (žádná duplicita)", async () => {
    const fas = stubFeatureAccessService();
    const { capabilityTypeRepo, machineRepo, valueRepo, capabilityType, machine } = await seed(fas);
    const assign = new AssignMachineCapabilityValueUseCase(tenantContext(), valueRepo, machineRepo, capabilityTypeRepo, fas);

    await assign.execute({ machineId: machine.id, capabilityTypeId: capabilityType.id, value: 400 });
    await assign.execute({ machineId: machine.id, capabilityTypeId: capabilityType.id, value: 450 });

    const values = await valueRepo.findByMachineId(machine.id, TENANT_ID);
    expect(values).toHaveLength(1);
    expect(values[0].value).toBe(450);
  });

  it("zamítne hodnotu se špatným typem (text místo čísla)", async () => {
    const fas = stubFeatureAccessService();
    const { capabilityTypeRepo, machineRepo, valueRepo, capabilityType, machine } = await seed(fas);
    const assign = new AssignMachineCapabilityValueUseCase(tenantContext(), valueRepo, machineRepo, capabilityTypeRepo, fas);

    await expect(
      assign.execute({ machineId: machine.id, capabilityTypeId: capabilityType.id, value: "velký" })
    ).rejects.toThrow(InvalidMasterDataValueError);
  });

  it("vyhodí NotFoundError pro neexistující stroj/capabilitu", async () => {
    const fas = stubFeatureAccessService();
    const capabilityTypeRepo = new IndexedDbCapabilityTypeRepository();
    const machineRepo = new IndexedDbMachineRepository();
    const valueRepo = new IndexedDbMachineCapabilityValueRepository();
    const assign = new AssignMachineCapabilityValueUseCase(tenantContext(), valueRepo, machineRepo, capabilityTypeRepo, fas);

    await expect(assign.execute({ machineId: "neexistuje", capabilityTypeId: "neexistuje", value: 1 })).rejects.toThrow(NotFoundError);
  });

  it("odebrání hodnoty capability", async () => {
    const fas = stubFeatureAccessService();
    const { capabilityTypeRepo, machineRepo, valueRepo, capabilityType, machine } = await seed(fas);
    const assign = new AssignMachineCapabilityValueUseCase(tenantContext(), valueRepo, machineRepo, capabilityTypeRepo, fas);
    const value = await assign.execute({ machineId: machine.id, capabilityTypeId: capabilityType.id, value: 400 });

    await new RemoveMachineCapabilityValueUseCase(tenantContext(), valueRepo, fas).execute(value.id);
    expect(await valueRepo.findByMachineId(machine.id, TENANT_ID)).toHaveLength(0);
  });
});

describe("UpdateCapabilityTypeUseCase", () => {
  beforeEach(async () => {
    await deleteTpvDbForTests();
  });

  it("deaktivace přes update (žádný samostatný deactivate use case)", async () => {
    const repo = new IndexedDbCapabilityTypeRepository();
    const fas = stubFeatureAccessService();
    const created = await new CreateCapabilityTypeUseCase(tenantContext(), repo, fas).execute({ code: "X", name: "X", valueType: "boolean" });
    const updated = await new UpdateCapabilityTypeUseCase(tenantContext(), repo, fas).execute(created.id, { status: "inactive" });
    expect(updated.status).toBe("inactive");
  });
});
