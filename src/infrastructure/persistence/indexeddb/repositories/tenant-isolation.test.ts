import { describe, it, expect, beforeEach } from "vitest";
import { Tool } from "@/domain/entities/tool";
import { CapabilityType } from "@/domain/entities/capability-type";
import { ExternalOperationResource } from "@/domain/entities/external-operation-resource";
import { ExternalResourceCode } from "@/domain/value-objects/external-resource-code";
import { Material } from "@/domain/entities/material";
import { MaterialGroup } from "@/domain/entities/material-group";
import { MaterialCode } from "@/domain/value-objects/material-code";
import { MaterialGroupCode } from "@/domain/value-objects/material-group-code";
import { IndexedDbToolRepository } from "./indexeddb-tool-repository";
import { IndexedDbCapabilityTypeRepository } from "./indexeddb-capability-type-repository";
import { IndexedDbExternalOperationResourceRepository } from "./indexeddb-external-operation-resource-repository";
import { IndexedDbMaterialRepository } from "./indexeddb-material-repository";
import { IndexedDbMaterialGroupRepository } from "./indexeddb-material-group-repository";
import { deleteTpvDbForTests } from "../tpv-db";

const TENANT_A = "tenant:isolation-a";
const TENANT_B = "tenant:isolation-b";

/**
 * Reprezentativní (ne vyčerpávající, viz zadání Kroku 5) kontrola tenant
 * izolace pro entity, které JEŠTĚ nemají vlastní tenant-izolační test jinde
 * (Machine/OperationType už mají - viz machine-tool-repositories.test.ts a
 * operation-type-use-cases.test.ts). Ověřuje, že `findById(id, tenantId)`
 * cizí tenant NIKDY nevidí, i když entitu s daným `id` reálně zná - zabraňuje
 * IDOR napříč organizacemi.
 */
describe("Tenant izolace - Tool, CapabilityType, ExternalOperationResource, Material", () => {
  beforeEach(async () => {
    await deleteTpvDbForTests();
  });

  it("Tool: cizí tenant nenajde nástroj podle id, ani ho nevidí v list()", async () => {
    const repo = new IndexedDbToolRepository();
    const tool = Tool.create({ id: "tool-1", tenantId: TENANT_A, nazev: "Nůž", toolTypeId: "tt-1", stav: "aktivni" });
    await repo.save(tool);

    expect(await repo.findById("tool-1", TENANT_A)).not.toBeNull();
    expect(await repo.findById("tool-1", TENANT_B)).toBeNull();
    expect(await repo.list(TENANT_B)).toHaveLength(0);
  });

  it("CapabilityType: kód smí kolidovat mezi tenanty, findByCode je tenant-scoped", async () => {
    const repo = new IndexedDbCapabilityTypeRepository();
    const capA = CapabilityType.create({ id: "cap-a", tenantId: TENANT_A, code: "LIVE_TOOLING", name: "A", valueType: "boolean", status: "active" });
    const capB = CapabilityType.create({ id: "cap-b", tenantId: TENANT_B, code: "LIVE_TOOLING", name: "B", valueType: "boolean", status: "active" });
    await repo.save(capA);
    await repo.save(capB);

    expect((await repo.findByCode(TENANT_A, "LIVE_TOOLING"))?.id).toBe("cap-a");
    expect((await repo.findByCode(TENANT_B, "LIVE_TOOLING"))?.id).toBe("cap-b");
    expect(await repo.findById("cap-a", TENANT_B)).toBeNull();
  });

  it("ExternalOperationResource: cizí tenant nevidí kooperaci", async () => {
    const repo = new IndexedDbExternalOperationResourceRepository();
    const resource = ExternalOperationResource.create({
      id: "koop-1",
      tenantId: TENANT_A,
      code: ExternalResourceCode.create("KOOP-TEP"),
      name: "Tepelné zpracování",
      status: "active",
    });
    await repo.save(resource);

    expect(await repo.findById("koop-1", TENANT_B)).toBeNull();
    expect(await repo.findByCode(TENANT_B, ExternalResourceCode.create("KOOP-TEP"))).toBeNull();
  });

  it("Material/MaterialGroup: cizí tenant nevidí materiál ani jeho skupinu", async () => {
    const groupRepo = new IndexedDbMaterialGroupRepository();
    const materialRepo = new IndexedDbMaterialRepository();

    const group = MaterialGroup.create({ id: "group-1", tenantId: TENANT_A, code: MaterialGroupCode.create("STEEL"), name: "Ocel", status: "active" });
    await groupRepo.save(group);
    const material = Material.create({
      id: "mat-1",
      tenantId: TENANT_A,
      code: MaterialCode.create("S235JR"),
      name: "S235JR",
      materialGroupId: group.id,
      status: "active",
    });
    await materialRepo.save(material);

    expect(await groupRepo.findById("group-1", TENANT_B)).toBeNull();
    expect(await materialRepo.findById("mat-1", TENANT_B)).toBeNull();
    expect(await materialRepo.list(TENANT_B)).toHaveLength(0);
  });
});
