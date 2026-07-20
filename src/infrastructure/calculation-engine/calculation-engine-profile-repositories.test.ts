import { describe, it, expect, beforeEach } from "vitest";
import { deleteTpvDbForTests } from "@/infrastructure/persistence/indexeddb/tpv-db";
import { IndexedDbExternalReferenceRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-external-reference-repository";
import { ExternalReference } from "@/domain/integrations/external-reference";
import { Material } from "@/domain/entities/material";
import { MaterialCode } from "@/domain/value-objects/material-code";
import { MaterialGroup } from "@/domain/entities/material-group";
import { MaterialGroupCode } from "@/domain/value-objects/material-group-code";
import { Machine } from "@/domain/entities/machine";
import { MachineCode } from "@/domain/value-objects/machine-code";
import { HourlyRate } from "@/domain/value-objects/hourly-rate";
import { Tool } from "@/domain/entities/tool";
import { ToolType } from "@/domain/entities/tool-type";
import { MaterialProfileFactory } from "@/domain/calculation-engine/profiles/material-profile-factory";
import { MaterialCorrection } from "@/domain/calculation-engine/profiles/material-correction";
import { MachineProfileFactory } from "@/domain/calculation-engine/profiles/machine-profile-factory";
import { MachineWorkEnvelope } from "@/domain/calculation-engine/profiles/machine-work-envelope";
import { MachineCorrection } from "@/domain/calculation-engine/profiles/machine-correction";
import { ToolProfileFactory } from "@/domain/calculation-engine/profiles/tool-profile-factory";
import { ToolCorrection } from "@/domain/calculation-engine/profiles/tool-correction";
import { ToolLifeProfile } from "@/domain/calculation-engine/profiles/tool-life-profile";
import { CuttingCondition } from "@/domain/calculation-engine/cutting-conditions/cutting-condition";
import { CuttingSpeed } from "@/domain/calculation-engine/value-objects/cutting-speed";
import { FeedRate } from "@/domain/calculation-engine/value-objects/feed-rate";
import { IndexedDbMaterialProfileRepository } from "./indexeddb-material-profile-repository";
import { IndexedDbMachineProfileRepository } from "./indexeddb-machine-profile-repository";
import { IndexedDbToolProfileRepository } from "./indexeddb-tool-profile-repository";
import { IndexedDbCuttingConditionRepository } from "./indexeddb-cutting-condition-repository";

const TENANT_ID = "tenant:acme";
const OTHER_TENANT_ID = "tenant:other";

describe("IndexedDbMaterialProfileRepository", () => {
  beforeEach(async () => {
    await deleteTpvDbForTests();
  });

  function systemProfile() {
    const material = Material.create({
      id: "material:1", tenantId: TENANT_ID, code: MaterialCode.create("OCEL-11523"),
      name: "Ocel 11 523", materialGroupId: "material-group:1", status: "active",
    });
    const group = MaterialGroup.create({ id: "material-group:1", tenantId: TENANT_ID, code: MaterialGroupCode.create("OCEL"), name: "Konstrukční oceli", status: "active" });
    return MaterialProfileFactory.createFromMaterial({
      material, materialGroup: group, sourceType: "system", dataSource: "master-data:material", now: "2025-01-01T00:00:00.000Z",
    });
  }

  it("Scénář 19: uloží a znovu načte MaterialProfile (round-trip), izolované podle tenanta", async () => {
    const repo = new IndexedDbMaterialProfileRepository(new IndexedDbExternalReferenceRepository());
    await repo.save(systemProfile());

    const found = await repo.getById("material:1", TENANT_ID);
    expect(found?.name).toBe("Ocel 11 523");
    expect(found?.materialGroupName).toBe("Konstrukční oceli");

    expect(await repo.getById("material:1", OTHER_TENANT_ID)).toBeNull();
  });

  it("uloží a najde MaterialCorrection podle materialProfileId", async () => {
    const repo = new IndexedDbMaterialProfileRepository(new IndexedDbExternalReferenceRepository());
    await repo.save(systemProfile());

    const correction = MaterialCorrection.create({
      id: "correction:1", tenantId: TENANT_ID, materialProfileId: "material:1", materialCoefficient: 1.2,
      reason: "Tenant má vlastní zkušenost s materiálem.", recordVersion: 1,
      createdAt: "2025-01-02T00:00:00.000Z", updatedAt: "2025-01-02T00:00:00.000Z",
    });
    await repo.saveCorrection(correction);

    const found = await repo.findCorrectionByProfileId("material:1", TENANT_ID);
    expect(found?.materialCoefficient).toBe(1.2);
    expect(await repo.findCorrectionByProfileId("material:1", OTHER_TENANT_ID)).toBeNull();
  });

  it("getSnapshot vrátí immutable snapshot aktuálního profilu", async () => {
    const repo = new IndexedDbMaterialProfileRepository(new IndexedDbExternalReferenceRepository());
    await repo.save(systemProfile());

    const snapshot = await repo.getSnapshot("material:1", TENANT_ID);
    expect(snapshot?.systemVersion).toBe(1);
    expect(snapshot?.resolvedData.name).toBe("Ocel 11 523");
  });

  it("Scénář 4: findByExternalReference namapuje externí ERP id na interní MaterialProfile", async () => {
    const externalReferenceRepository = new IndexedDbExternalReferenceRepository();
    await externalReferenceRepository.save(
      ExternalReference.create({
        id: "ext-ref:1", tenantId: TENANT_ID, externalSystemId: "external-system:erp1",
        localEntityType: "material", localEntityId: "material:1", externalEntityType: "Material",
        externalId: "ERP-MAT-123", createdAt: "2025-01-01T00:00:00.000Z", updatedAt: "2025-01-01T00:00:00.000Z",
      })
    );

    const repo = new IndexedDbMaterialProfileRepository(externalReferenceRepository);
    await repo.save(systemProfile());

    const found = await repo.findByExternalReference("external-system:erp1", "ERP-MAT-123", TENANT_ID);
    expect(found?.id).toBe("material:1");
    expect(await repo.findByExternalReference("external-system:erp1", "NEEXISTUJE", TENANT_ID)).toBeNull();
  });
});

describe("IndexedDbMachineProfileRepository", () => {
  beforeEach(async () => {
    await deleteTpvDbForTests();
  });

  function systemProfile() {
    const machine = Machine.create({
      id: "machine:1", tenantId: TENANT_ID, code: MachineCode.create("SP-430"), name: "Soustruh SP-430",
      maxRpm: 4000, maxPowerKw: 15, hourlyRate: HourlyRate.of(900, "CZK"), status: "active", capacityGroupId: "capacity-group:1",
    });
    return MachineProfileFactory.createFromMachine({
      id: "machine-profile:1", machine, workEnvelope: MachineWorkEnvelope.create({ maxDiameterMm: 300, maxLengthMm: 1000 }),
      maxPartWeightKg: 150, now: "2025-01-01T00:00:00.000Z",
    });
  }

  it("Scénář 19: uloží a znovu načte MachineProfile (round-trip) včetně workEnvelope", async () => {
    const repo = new IndexedDbMachineProfileRepository(new IndexedDbExternalReferenceRepository());
    await repo.save(systemProfile());

    const found = await repo.getById("machine-profile:1", TENANT_ID);
    expect(found?.physicalMachineId).toBe("machine:1");
    expect(found?.workEnvelope?.maxDiameterMm).toBe(300);
    expect(found?.logicalWorkstationId).toBe("capacity-group:1");

    expect(await repo.getById("machine-profile:1", OTHER_TENANT_ID)).toBeNull();
  });

  it("uloží a najde MachineCorrection podle machineProfileId", async () => {
    const repo = new IndexedDbMachineProfileRepository(new IndexedDbExternalReferenceRepository());
    await repo.save(systemProfile());

    const correction = MachineCorrection.create({
      id: "correction:1", tenantId: TENANT_ID, machineProfileId: "machine-profile:1", conditionCoefficient: 0.9,
      reason: "Stroj je starší, snížená kondice.", recordVersion: 1,
      createdAt: "2025-01-02T00:00:00.000Z", updatedAt: "2025-01-02T00:00:00.000Z",
    });
    await repo.saveCorrection(correction);

    const found = await repo.findCorrectionByProfileId("machine-profile:1", TENANT_ID);
    expect(found?.conditionCoefficient).toBe(0.9);
  });

  it("findByExternalReference namapuje externí id (Machine.id) na MachineProfile přes physicalMachineId", async () => {
    const externalReferenceRepository = new IndexedDbExternalReferenceRepository();
    await externalReferenceRepository.save(
      ExternalReference.create({
        id: "ext-ref:2", tenantId: TENANT_ID, externalSystemId: "external-system:erp1",
        localEntityType: "machine", localEntityId: "machine:1", externalEntityType: "Workplace",
        externalId: "ERP-MACH-1", createdAt: "2025-01-01T00:00:00.000Z", updatedAt: "2025-01-01T00:00:00.000Z",
      })
    );

    const repo = new IndexedDbMachineProfileRepository(externalReferenceRepository);
    await repo.save(systemProfile());

    const found = await repo.findByExternalReference("external-system:erp1", "ERP-MACH-1", TENANT_ID);
    expect(found?.id).toBe("machine-profile:1");
  });
});

describe("IndexedDbToolProfileRepository", () => {
  beforeEach(async () => {
    await deleteTpvDbForTests();
  });

  function systemProfile() {
    const tool = Tool.create({ id: "tool:1", tenantId: TENANT_ID, nazev: "Vrták Ø10", toolTypeId: "tool-type:1", stav: "aktivni" });
    const toolType = ToolType.create({ id: "tool-type:1", tenantId: TENANT_ID, kod: "VRTAK", nazev: "Vrták", category: "drill", parameterDefinitions: [], stav: "aktivni" });
    return ToolProfileFactory.createFromTool({
      tool, toolType, suitableMaterialGroupIds: ["material-group:ocel"],
      toolLife: ToolLifeProfile.ofBoth(200, 90), now: "2025-01-01T00:00:00.000Z",
    });
  }

  it("Scénář 19: uloží a znovu načte ToolProfile (round-trip) včetně toolLife", async () => {
    const repo = new IndexedDbToolProfileRepository(new IndexedDbExternalReferenceRepository());
    await repo.save(systemProfile());

    const found = await repo.getById("tool:1", TENANT_ID);
    expect(found?.toolTypeName).toBe("Vrták");
    expect(found?.toolLife.pieceLimit?.value).toBe(200);
    expect(found?.toolLife.timeLimit?.value).toBe(90);
    expect(found?.suitableMaterialGroupIds).toEqual(["material-group:ocel"]);

    expect(await repo.getById("tool:1", OTHER_TENANT_ID)).toBeNull();
  });

  it("uloží a najde ToolCorrection podle toolProfileId", async () => {
    const repo = new IndexedDbToolProfileRepository(new IndexedDbExternalReferenceRepository());
    await repo.save(systemProfile());

    const correction = ToolCorrection.create({
      id: "correction:1", tenantId: TENANT_ID, toolProfileId: "tool:1", toolChangeTimeSec: 45,
      reason: "Reálná výměna trvá déle.", recordVersion: 1,
      createdAt: "2025-01-02T00:00:00.000Z", updatedAt: "2025-01-02T00:00:00.000Z",
    });
    await repo.saveCorrection(correction);

    const found = await repo.findCorrectionByProfileId("tool:1", TENANT_ID);
    expect(found?.toolChangeTimeSec).toBe(45);
  });
});

describe("IndexedDbCuttingConditionRepository", () => {
  beforeEach(async () => {
    await deleteTpvDbForTests();
  });

  function condition(overrides: Partial<Parameters<typeof CuttingCondition.create>[0]> = {}) {
    return CuttingCondition.create({
      id: "cc:1", tenantId: TENANT_ID, materialProfileId: "material:1", toolProfileId: "tool:1",
      operationCategory: "turning", cuttingSpeed: CuttingSpeed.ofMetersPerMinute(120),
      feedPerRevolution: FeedRate.of(0.2, "mm_per_rev"), source: "tenant_approved", priority: 1, confidence: 0.9,
      ruleVersion: "rv:1", validFrom: "2025-01-01T00:00:00.000Z", ...overrides,
    });
  }

  it("Scénář 19: uloží a znovu načte CuttingCondition (round-trip) včetně hodnotových objektů", async () => {
    const repo = new IndexedDbCuttingConditionRepository(new IndexedDbExternalReferenceRepository());
    await repo.save(condition());

    const found = await repo.getById("cc:1", TENANT_ID);
    expect(found?.cuttingSpeed?.metersPerMinute).toBe(120);
    expect(found?.feedPerRevolution?.value).toBe(0.2);
    expect(found?.source).toBe("tenant_approved");

    expect(await repo.getById("cc:1", OTHER_TENANT_ID)).toBeNull();
  });

  it("findCandidates vrátí jen podmínky odpovídající kritériím", async () => {
    const repo = new IndexedDbCuttingConditionRepository(new IndexedDbExternalReferenceRepository());
    await repo.save(condition({ id: "cc:match", toolProfileId: "tool:1" }));
    await repo.save(condition({ id: "cc:other-tool", toolProfileId: "tool:2" }));

    const candidates = await repo.findCandidates({
      tenantId: TENANT_ID, materialProfileId: "material:1", toolProfileId: "tool:1", operationCategory: "turning",
    });
    expect(candidates.map((c) => c.id)).toEqual(["cc:match"]);
  });

  it("findSystemDefault najde tenant-wide výchozí hodnotu pro danou kategorii operace", async () => {
    const repo = new IndexedDbCuttingConditionRepository(new IndexedDbExternalReferenceRepository());
    await repo.save(condition({ id: "cc:default", source: "system_default", toolProfileId: undefined, machineProfileId: undefined }));

    const found = await repo.findSystemDefault(TENANT_ID, "turning");
    expect(found?.id).toBe("cc:default");
    expect(await repo.findSystemDefault(TENANT_ID, "milling")).toBeNull();
  });

  it("Scénář 20: offline resolvování - všechny repozitáře fungují nad lokální IndexedDB bez sítě", async () => {
    const materialRepo = new IndexedDbMaterialProfileRepository(new IndexedDbExternalReferenceRepository());
    const material = Material.create({
      id: "material:1", tenantId: TENANT_ID, code: MaterialCode.create("OCEL-11523"),
      name: "Ocel 11 523", materialGroupId: "material-group:1", status: "active",
    });
    const group = MaterialGroup.create({ id: "material-group:1", tenantId: TENANT_ID, code: MaterialGroupCode.create("OCEL"), name: "Konstrukční oceli", status: "active" });
    await materialRepo.save(
      MaterialProfileFactory.createFromMaterial({
        material, materialGroup: group, sourceType: "system", dataSource: "master-data:material", now: "2025-01-01T00:00:00.000Z",
      })
    );

    const conditionRepo = new IndexedDbCuttingConditionRepository(new IndexedDbExternalReferenceRepository());
    await conditionRepo.save(condition());

    // Vše proběhlo výhradně nad `fake-indexeddb` (lokální, bez síťového volání) -
    // simuluje offline provoz appky (AP-MCE-001 Fáze B, scénář "offline context resolution").
    const resolvedMaterial = await materialRepo.getById("material:1", TENANT_ID);
    const candidates = await conditionRepo.findCandidates({
      tenantId: TENANT_ID, materialProfileId: "material:1", toolProfileId: "tool:1", operationCategory: "turning",
    });
    expect(resolvedMaterial).not.toBeNull();
    expect(candidates).toHaveLength(1);
  });
});
