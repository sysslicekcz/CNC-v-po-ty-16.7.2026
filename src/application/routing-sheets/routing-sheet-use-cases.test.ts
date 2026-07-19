import { describe, it, expect, beforeEach } from "vitest";
import { CreateRoutingSheetUseCase } from "./create-routing-sheet-use-case";
import { GetRoutingSheetEditorUseCase } from "./get-routing-sheet-editor-use-case";
import { SaveRoutingSheetDraftUseCase } from "./save-routing-sheet-draft-use-case";
import { ReleaseRoutingSheetUseCase } from "./release-routing-sheet-use-case";
import { CreateRoutingSheetRevisionUseCase } from "./create-routing-sheet-revision-use-case";
import { DuplicateRoutingSheetUseCase } from "./duplicate-routing-sheet-use-case";
import { RoutingSheetDraftAlreadyExistsError } from "./errors";
import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCode } from "@/domain/licensing/feature-code";
import { FeatureAccess } from "@/domain/licensing/feature-access";
import { LicenseLimitCode } from "@/domain/licensing/license-limit-code";
import { FeatureNotLicensedError, LicenseLimitExceededError } from "@/domain/errors/license-errors";
import { NotFoundError } from "@/domain/errors/not-found-error";
import { InvalidStateError } from "@/domain/errors/invalid-state-error";
import { ConcurrentModificationError } from "@/domain/errors/routing-sheet-errors";
import { Part } from "@/domain/entities/part";
import { Quantity } from "@/domain/value-objects/quantity";
import { Machine } from "@/domain/entities/machine";
import { MachineCode } from "@/domain/value-objects/machine-code";
import { HourlyRate } from "@/domain/value-objects/hourly-rate";
import { IndexedDbRoutingSheetRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-routing-sheet-repository";
import { IndexedDbReleasedRoutingSheetSnapshotRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-released-routing-sheet-snapshot-repository";
import { IndexedDbPartRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-part-repository";
import { IndexedDbMachineRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-machine-repository";
import { IndexedDbExternalOperationResourceRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-external-operation-resource-repository";
import { IndexedDbOperationTypeRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-operation-type-repository";
import { IndexedDbToolRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-tool-repository";
import { deleteTpvDbForTests } from "@/infrastructure/persistence/indexeddb/tpv-db";

const TENANT_ID = "tenant:routing-sheet-use-cases";
const OTHER_TENANT_ID = "tenant:other";

function tenantContext(tenantId: string = TENANT_ID): TenantContext {
  return { getCurrentTenantId: () => tenantId, requireCurrentTenantId: () => tenantId };
}

/** Stejný vzor jako machine-use-cases.test.ts - řízené grant/deny/limit chování. */
function stubFeatureAccessService(options: { access?: FeatureAccess; limit?: number | null } = {}): FeatureAccessService {
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

async function seedPart(id: string): Promise<Part> {
  const part = Part.create({ id, orderId: "order-1", nazev: "Test díl", mnozstvi: Quantity.of(1, "ks"), cisloVykresu: "V-1" });
  await new IndexedDbPartRepository().save(part);
  return part;
}

async function seedMachine(id: string): Promise<Machine> {
  const machine = Machine.create({
    id,
    tenantId: TENANT_ID,
    code: MachineCode.create(id.toUpperCase()),
    name: `Stroj ${id}`,
    hourlyRate: HourlyRate.of(1000),
    status: "active",
  });
  await new IndexedDbMachineRepository().save(machine);
  return machine;
}

describe("CreateRoutingSheetUseCase", () => {
  beforeEach(async () => {
    await deleteTpvDbForTests();
  });

  it("založí revizi 1 jako výchozí draft", async () => {
    await seedPart("part-1");
    const repo = new IndexedDbRoutingSheetRepository();
    const useCase = new CreateRoutingSheetUseCase(tenantContext(), repo, new IndexedDbPartRepository(), stubFeatureAccessService());

    const rs = await useCase.execute({ partId: "part-1" });
    expect(rs.revisionNumber).toBe(1);
    expect(rs.isDefault).toBe(true);
    expect(rs.stav).toBe("draft");
    expect(rs.tenantId).toBe(TENANT_ID);
  });

  it("zamítne založení druhého draftu pro stejný díl", async () => {
    await seedPart("part-1");
    const repo = new IndexedDbRoutingSheetRepository();
    const useCase = new CreateRoutingSheetUseCase(tenantContext(), repo, new IndexedDbPartRepository(), stubFeatureAccessService());

    await useCase.execute({ partId: "part-1" });
    await expect(useCase.execute({ partId: "part-1" })).rejects.toThrow(RoutingSheetDraftAlreadyExistsError);
  });

  it("zamítne založení bez licence routing.edit", async () => {
    await seedPart("part-1");
    const repo = new IndexedDbRoutingSheetRepository();
    const useCase = new CreateRoutingSheetUseCase(
      tenantContext(),
      repo,
      new IndexedDbPartRepository(),
      stubFeatureAccessService({ access: "none" })
    );
    await expect(useCase.execute({ partId: "part-1" })).rejects.toThrow(FeatureNotLicensedError);
  });

  it("zamítne založení pro neexistující díl", async () => {
    const repo = new IndexedDbRoutingSheetRepository();
    const useCase = new CreateRoutingSheetUseCase(tenantContext(), repo, new IndexedDbPartRepository(), stubFeatureAccessService());
    await expect(useCase.execute({ partId: "neexistuje" })).rejects.toThrow(NotFoundError);
  });

  it("respektuje licenční limit routingSheets.active.max", async () => {
    await seedPart("part-1");
    await seedPart("part-2");
    const repo = new IndexedDbRoutingSheetRepository();
    const useCase = new CreateRoutingSheetUseCase(tenantContext(), repo, new IndexedDbPartRepository(), stubFeatureAccessService({ limit: 1 }));

    await useCase.execute({ partId: "part-1" });
    await expect(useCase.execute({ partId: "part-2" })).rejects.toThrow(LicenseLimitExceededError);
  });
});

describe("GetRoutingSheetEditorUseCase", () => {
  beforeEach(async () => {
    await deleteTpvDbForTests();
  });

  function makeUseCase(tenantId: string = TENANT_ID) {
    return new GetRoutingSheetEditorUseCase(
      tenantContext(tenantId),
      new IndexedDbRoutingSheetRepository(),
      new IndexedDbPartRepository(),
      new IndexedDbMachineRepository(),
      new IndexedDbExternalOperationResourceRepository(),
      new IndexedDbOperationTypeRepository(),
      new IndexedDbToolRepository(),
      stubFeatureAccessService()
    );
  }

  it("sestaví editor DTO se seznamem validačních nálezů", async () => {
    await seedPart("part-1");
    const created = await new CreateRoutingSheetUseCase(
      tenantContext(),
      new IndexedDbRoutingSheetRepository(),
      new IndexedDbPartRepository(),
      stubFeatureAccessService()
    ).execute({ partId: "part-1" });

    const dto = await makeUseCase().execute(created.id);
    expect(dto.id).toBe(created.id);
    expect(dto.operations).toHaveLength(0);
  });

  it("vrátí NotFoundError pro cizí tenant stejně jako pro neexistující id", async () => {
    await seedPart("part-1");
    const created = await new CreateRoutingSheetUseCase(
      tenantContext(),
      new IndexedDbRoutingSheetRepository(),
      new IndexedDbPartRepository(),
      stubFeatureAccessService()
    ).execute({ partId: "part-1" });

    await expect(makeUseCase(OTHER_TENANT_ID).execute(created.id)).rejects.toThrow(NotFoundError);
    await expect(makeUseCase().execute("neexistuje")).rejects.toThrow(NotFoundError);
  });
});

describe("SaveRoutingSheetDraftUseCase", () => {
  beforeEach(async () => {
    await deleteTpvDbForTests();
  });

  it("uloží draft a zapíše touch (updatedAt/updatedBy)", async () => {
    await seedPart("part-1");
    const repo = new IndexedDbRoutingSheetRepository();
    const created = await new CreateRoutingSheetUseCase(tenantContext(), repo, new IndexedDbPartRepository(), stubFeatureAccessService()).execute({
      partId: "part-1",
    });

    const save = new SaveRoutingSheetDraftUseCase(tenantContext(), repo, stubFeatureAccessService());
    await save.execute({ routingSheet: created, updatedBy: "tech-1" });

    const reloaded = await repo.findById(created.id, TENANT_ID);
    expect(reloaded?.updatedBy).toBe("tech-1");
    expect(reloaded?.updatedAt).toBeDefined();
  });

  it("zamítne uložení postupu, který už není draft", async () => {
    await seedPart("part-1");
    const repo = new IndexedDbRoutingSheetRepository();
    const created = await new CreateRoutingSheetUseCase(tenantContext(), repo, new IndexedDbPartRepository(), stubFeatureAccessService()).execute({
      partId: "part-1",
    });
    created.addOperation({ id: "op-1", nazev: "A", machineId: "m-1" });
    created.updateOperation("op-1", { unitTimeMinutes: 1 });
    created.release(new Date());

    const save = new SaveRoutingSheetDraftUseCase(tenantContext(), repo, stubFeatureAccessService());
    await expect(save.execute({ routingSheet: created })).rejects.toThrow(InvalidStateError);
  });

  it("vyhodí ConcurrentModificationError, pokud se uložený updatedAt liší od očekávaného", async () => {
    await seedPart("part-1");
    const repo = new IndexedDbRoutingSheetRepository();
    const created = await new CreateRoutingSheetUseCase(tenantContext(), repo, new IndexedDbPartRepository(), stubFeatureAccessService()).execute({
      partId: "part-1",
    });
    const save = new SaveRoutingSheetDraftUseCase(tenantContext(), repo, stubFeatureAccessService());

    // "Karta A" uloží první změnu.
    await save.execute({ routingSheet: created, updatedBy: "tech-A" });

    // "Karta B" má zastaralou představu o updatedAt (nikdy nenačetla novější stav).
    const staleClientCopy = await repo.findById(created.id, TENANT_ID);
    await expect(
      save.execute({ routingSheet: staleClientCopy!, expectedUpdatedAt: new Date(0).toISOString() })
    ).rejects.toThrow(ConcurrentModificationError);
  });
});

describe("ReleaseRoutingSheetUseCase a CreateRoutingSheetRevisionUseCase", () => {
  beforeEach(async () => {
    await deleteTpvDbForTests();
  });

  function makeReleaseUseCase() {
    return new ReleaseRoutingSheetUseCase(
      tenantContext(),
      new IndexedDbRoutingSheetRepository(),
      new IndexedDbReleasedRoutingSheetSnapshotRepository(),
      new IndexedDbPartRepository(),
      new IndexedDbMachineRepository(),
      new IndexedDbExternalOperationResourceRepository(),
      new IndexedDbOperationTypeRepository(),
      new IndexedDbToolRepository(),
      stubFeatureAccessService()
    );
  }

  it("odmítne vydat postup s blokující chybou (chybí zdroj operace)", async () => {
    await seedPart("part-1");
    const repo = new IndexedDbRoutingSheetRepository();
    const created = await new CreateRoutingSheetUseCase(tenantContext(), repo, new IndexedDbPartRepository(), stubFeatureAccessService()).execute({
      partId: "part-1",
    });
    created.addOperation({ id: "op-1", nazev: "A" }); // bez zdroje
    await repo.save(created);

    await expect(makeReleaseUseCase().execute({ routingSheetId: created.id })).rejects.toThrow();
    const reloaded = await repo.findById(created.id, TENANT_ID);
    expect(reloaded?.stav).toBe("draft"); // žádná částečná mutace
  });

  it("vydá validní postup a vytvoří immutable snapshot", async () => {
    await seedPart("part-1");
    await seedMachine("m-1");
    const repo = new IndexedDbRoutingSheetRepository();
    const created = await new CreateRoutingSheetUseCase(tenantContext(), repo, new IndexedDbPartRepository(), stubFeatureAccessService()).execute({
      partId: "part-1",
    });
    created.addOperation({ id: "op-1", nazev: "A", machineId: "m-1" });
    created.updateOperation("op-1", { unitTimeMinutes: 5 });
    await repo.save(created);

    const snapshot = await makeReleaseUseCase().execute({ routingSheetId: created.id, releasedBy: "tech-1" });
    expect(snapshot.routingSheetId).toBe(created.id);
    expect(snapshot.releasedBy).toBe("tech-1");

    const reloaded = await repo.findById(created.id, TENANT_ID);
    expect(reloaded?.stav).toBe("released");
  });

  it("CreateRoutingSheetRevisionUseCase: archivuje zdroj, přenese příznak výchozí na novou revizi", async () => {
    await seedPart("part-1");
    await seedMachine("m-1");
    const repo = new IndexedDbRoutingSheetRepository();
    const created = await new CreateRoutingSheetUseCase(tenantContext(), repo, new IndexedDbPartRepository(), stubFeatureAccessService()).execute({
      partId: "part-1",
    });
    created.addOperation({ id: "op-1", nazev: "A", machineId: "m-1" });
    created.updateOperation("op-1", { unitTimeMinutes: 5 });
    await repo.save(created);
    await makeReleaseUseCase().execute({ routingSheetId: created.id });

    const revisionUseCase = new CreateRoutingSheetRevisionUseCase(tenantContext(), repo, stubFeatureAccessService());
    const revision2 = await revisionUseCase.execute({ sourceRoutingSheetId: created.id });

    expect(revision2.revisionNumber).toBe(2);
    expect(revision2.stav).toBe("draft");
    expect(revision2.isDefault).toBe(true);
    expect(revision2.operationList).toHaveLength(1); // strom se zkopíroval

    const archivedSource = await repo.findById(created.id, TENANT_ID);
    expect(archivedSource?.stav).toBe("archived");
    expect(archivedSource?.isDefault).toBe(false); // Krok 4 fix: nikdy dvě "výchozí" současně

    const onlyOneDefault = (await repo.list(TENANT_ID)).filter((rs) => rs.isDefault);
    expect(onlyOneDefault).toHaveLength(1);
    expect(onlyOneDefault[0].id).toBe(revision2.id);
  });

  it("CreateRoutingSheetRevisionUseCase: odmítne revizi z ne-vydaného postupu", async () => {
    await seedPart("part-1");
    const repo = new IndexedDbRoutingSheetRepository();
    const created = await new CreateRoutingSheetUseCase(tenantContext(), repo, new IndexedDbPartRepository(), stubFeatureAccessService()).execute({
      partId: "part-1",
    });
    const revisionUseCase = new CreateRoutingSheetRevisionUseCase(tenantContext(), repo, stubFeatureAccessService());
    await expect(revisionUseCase.execute({ sourceRoutingSheetId: created.id })).rejects.toThrow(InvalidStateError);
  });
});

describe("DuplicateRoutingSheetUseCase", () => {
  beforeEach(async () => {
    await deleteTpvDbForTests();
  });

  it("vytvoří kopii, zdroj zůstane beze změny a výchozí zůstane jen zdroj", async () => {
    await seedPart("part-1");
    const repo = new IndexedDbRoutingSheetRepository();
    const created = await new CreateRoutingSheetUseCase(tenantContext(), repo, new IndexedDbPartRepository(), stubFeatureAccessService()).execute({
      partId: "part-1",
    });
    created.addOperation({ id: "op-1", nazev: "A", machineId: "m-1" });
    await repo.save(created);
    await makeReleaseCompatible(repo); // released source umožní draft-check pro duplikaci projít

    const duplicateUseCase = new DuplicateRoutingSheetUseCase(tenantContext(), repo, stubFeatureAccessService());
    const duplicate = await duplicateUseCase.execute({ sourceRoutingSheetId: created.id, name: "Kopie" });

    expect(duplicate.stav).toBe("draft");
    expect(duplicate.isDefault).toBe(false);
    expect(duplicate.nazev).toBe("Kopie");

    const source = await repo.findById(created.id, TENANT_ID);
    expect(source?.isDefault).toBe(true); // zdroj se duplikací nemění
  });

  async function makeReleaseCompatible(repo: IndexedDbRoutingSheetRepository): Promise<void> {
    // Duplicate lze volat nad libovolným stavem, ale vyžaduje neexistenci jiného draftu
    // pro díl - zdroj (draft) proto napřed vydáme, ať vznikne prostor pro nový draft.
    const source = (await repo.list(TENANT_ID))[0];
    source.updateOperation("op-1", { unitTimeMinutes: 5 });
    source.release(new Date());
    await repo.save(source);
  }
});

describe("Integrační scénář: díl -> draft -> operace -> upnutí/činnost -> uložení -> vydání -> revize", () => {
  beforeEach(async () => {
    await deleteTpvDbForTests();
  });

  it("projde celým životním cyklem a zachová immutable snapshot i po vzniku nové revize", async () => {
    await seedPart("part-1");
    await seedMachine("m-1");
    await seedMachine("m-2");

    const routingSheetRepository = new IndexedDbRoutingSheetRepository();
    const partRepository = new IndexedDbPartRepository();
    const machineRepository = new IndexedDbMachineRepository();
    const externalResourceRepository = new IndexedDbExternalOperationResourceRepository();
    const operationTypeRepository = new IndexedDbOperationTypeRepository();
    const toolRepository = new IndexedDbToolRepository();
    const releasedSnapshotRepository = new IndexedDbReleasedRoutingSheetSnapshotRepository();
    const featureAccessService = stubFeatureAccessService();

    const createRoutingSheetUseCase = new CreateRoutingSheetUseCase(tenantContext(), routingSheetRepository, partRepository, featureAccessService);
    const saveRoutingSheetDraftUseCase = new SaveRoutingSheetDraftUseCase(tenantContext(), routingSheetRepository, featureAccessService);
    const getRoutingSheetEditorUseCase = new GetRoutingSheetEditorUseCase(
      tenantContext(),
      routingSheetRepository,
      partRepository,
      machineRepository,
      externalResourceRepository,
      operationTypeRepository,
      toolRepository,
      featureAccessService
    );
    const releaseRoutingSheetUseCase = new ReleaseRoutingSheetUseCase(
      tenantContext(),
      routingSheetRepository,
      releasedSnapshotRepository,
      partRepository,
      machineRepository,
      externalResourceRepository,
      operationTypeRepository,
      toolRepository,
      featureAccessService
    );
    const createRoutingSheetRevisionUseCase = new CreateRoutingSheetRevisionUseCase(tenantContext(), routingSheetRepository, featureAccessService);

    // 1) Založ draft.
    const routingSheet = await createRoutingSheetUseCase.execute({ partId: "part-1", name: "Integrační test" });

    // 2) Dvě operace, přiřazení strojů, upnutí a činnost.
    routingSheet.addOperation({ id: "op-1", nazev: "Soustružení", machineId: "m-1" });
    routingSheet.addOperation({ id: "op-2", nazev: "Frézování", machineId: "m-2" });
    routingSheet.updateOperation("op-1", { unitTimeMinutes: 5 });
    routingSheet.updateOperation("op-2", { unitTimeMinutes: 3 });
    routingSheet.addPosition("op-1", { id: "pos-1", nazev: "Upnutí 1" });
    routingSheet.addActivity("op-1", "pos-1", { id: "act-1", operationTypeId: "ot-1", calculationType: "podelneVnejsi" });

    // 3) Ulož draft (touch + persistence) a znovu ho načti přes editor use case.
    await saveRoutingSheetDraftUseCase.execute({ routingSheet, updatedBy: "tech-1" });
    const editorDto = await getRoutingSheetEditorUseCase.execute(routingSheet.id);
    expect(editorDto.operations).toHaveLength(2);
    expect(editorDto.operations[0].positions[0].activities[0].operationTypeId).toBe("ot-1");
    // "ot-1" není v operationTypesById (nebyl seedován) - validace to musí nahlásit jako informaci pro draft.
    expect(editorDto.validationIssues.some((i) => i.code === "activity-unknown-operation-type")).toBe(true);

    // 4) Znovu načtený agregát z repository (jiná instance) musí obsahovat totéž.
    const reloaded = await routingSheetRepository.findById(routingSheet.id, TENANT_ID);
    expect(reloaded?.operationList).toHaveLength(2);
    expect(reloaded?.updatedBy).toBe("tech-1");

    // 5) Vydání zablokuje kvůli neznámému typu operace na Activity - odstraníme
    // problematickou Activity, aby šlo pokračovat na "vydání projde".
    reloaded!.removeActivity("op-1", "pos-1", "act-1");
    await routingSheetRepository.save(reloaded!);

    const snapshot = await releaseRoutingSheetUseCase.execute({ routingSheetId: routingSheet.id, releasedBy: "tech-1" });
    expect(snapshot.operations).toHaveLength(2);
    expect(snapshot.releasedBy).toBe("tech-1");

    const releasedRoutingSheet = await routingSheetRepository.findById(routingSheet.id, TENANT_ID);
    expect(releasedRoutingSheet?.stav).toBe("released");
    expect(releasedRoutingSheet?.isEditable).toBe(false);

    // 6) Nová revize vznikne jako kopie, zdroj se archivuje a ztratí příznak výchozí.
    const revision2 = await createRoutingSheetRevisionUseCase.execute({ sourceRoutingSheetId: routingSheet.id });
    expect(revision2.revisionNumber).toBe(2);
    expect(revision2.isDefault).toBe(true);
    expect(revision2.operationList).toHaveLength(2);

    const archivedSource = await routingSheetRepository.findById(routingSheet.id, TENANT_ID);
    expect(archivedSource?.stav).toBe("archived");
    expect(archivedSource?.isDefault).toBe(false);

    // 7) Immutable snapshot vydané revize 1 zůstává čitelný a nezměněný i po vzniku revize 2.
    const snapshotAfterRevision = await releasedSnapshotRepository.findByRoutingSheetId(routingSheet.id, TENANT_ID);
    expect(snapshotAfterRevision?.operations).toHaveLength(2);
    expect(snapshotAfterRevision?.revision).toBe(1);
  });
});
