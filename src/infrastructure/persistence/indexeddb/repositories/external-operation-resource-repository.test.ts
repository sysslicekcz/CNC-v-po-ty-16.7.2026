import { describe, it, expect, beforeEach } from "vitest";
import { ExternalOperationResource } from "@/domain/entities/external-operation-resource";
import { ExternalResourceCode } from "@/domain/value-objects/external-resource-code";
import { DEFAULT_TENANT_ID } from "@/domain/entities/tenant";
import { ExternalResourceCodeAlreadyExistsError } from "@/domain/errors/external-resource-code-already-exists-error";
import { IndexedDbExternalOperationResourceRepository } from "./indexeddb-external-operation-resource-repository";
import { deleteTpvDbForTests } from "../tpv-db";

const OTHER_TENANT_ID = "tenant:other";

describe("ExternalOperationResource (kooperace)", () => {
  beforeEach(async () => {
    await deleteTpvDbForTests();
  });

  it("má vlastní id a code, nezávislé na Machine (kooperace není stroj)", async () => {
    const repo = new IndexedDbExternalOperationResourceRepository();
    const resource = ExternalOperationResource.create({
      id: "coop-1",
      tenantId: DEFAULT_TENANT_ID,
      code: ExternalResourceCode.create("KALIRNA-EXTERNI"),
      name: "Kalírna s.r.o. - tepelné zpracování",
      status: "active",
    });
    await repo.save(resource);

    const found = await repo.findById("coop-1", DEFAULT_TENANT_ID);
    expect(found).not.toBeNull();
    expect(found?.code.toString()).toBe("KALIRNA-EXTERNI");
    // Typová kontrola - žádné machineId/hourlyRate/capacityGroupId pole na ExternalOperationResource.
    expect((found as unknown as { hourlyRate?: unknown }).hourlyRate).toBeUndefined();
  });

  it("izoluje kooperace mezi tenanty stejně jako stroje", async () => {
    const repo = new IndexedDbExternalOperationResourceRepository();
    await repo.save(
      ExternalOperationResource.create({
        id: "coop-tenant-a",
        tenantId: DEFAULT_TENANT_ID,
        code: ExternalResourceCode.create("NDT-1"),
        name: "NDT kooperace",
        status: "active",
      })
    );

    expect(await repo.findById("coop-tenant-a", OTHER_TENANT_ID)).toBeNull();
    expect(await repo.list(OTHER_TENANT_ID)).toHaveLength(0);
    expect(await repo.list(DEFAULT_TENANT_ID)).toHaveLength(1);
  });

  it("hlídá unikátnost kódu v rámci tenanta", async () => {
    const repo = new IndexedDbExternalOperationResourceRepository();
    await repo.save(
      ExternalOperationResource.create({
        id: "coop-1",
        tenantId: DEFAULT_TENANT_ID,
        code: ExternalResourceCode.create("CERNENI"),
        name: "Černění",
        status: "active",
      })
    );

    await expect(
      repo.save(
        ExternalOperationResource.create({
          id: "coop-2",
          tenantId: DEFAULT_TENANT_ID,
          code: ExternalResourceCode.create("CERNENI"),
          name: "Jiná kooperace se stejným kódem",
          status: "active",
        })
      )
    ).rejects.toThrow(ExternalResourceCodeAlreadyExistsError);
  });
});
