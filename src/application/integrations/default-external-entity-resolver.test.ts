import { describe, it, expect, beforeEach } from "vitest";
import { DefaultExternalEntityResolver } from "./default-external-entity-resolver";
import { ExternalReference } from "@/domain/integrations/external-reference";
import { DEFAULT_TENANT_ID } from "@/domain/entities/tenant";
import { IndexedDbExternalReferenceRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-external-reference-repository";
import { deleteTpvDbForTests } from "@/infrastructure/persistence/indexeddb/tpv-db";

const EXTERNAL_SYSTEM_ID = "sys-1";

describe("DefaultExternalEntityResolver", () => {
  beforeEach(async () => {
    await deleteTpvDbForTests();
  });

  it("matched přes existující ExternalReference (externalId)", async () => {
    const references = new IndexedDbExternalReferenceRepository();
    const now = new Date().toISOString();
    await references.save(
      ExternalReference.create({
        id: "ref-1",
        tenantId: DEFAULT_TENANT_ID,
        externalSystemId: EXTERNAL_SYSTEM_ID,
        localEntityType: "machine",
        localEntityId: "machine-internal-1",
        externalEntityType: "workplace",
        externalId: "300-58140",
        createdAt: now,
        updatedAt: now,
      })
    );

    const resolver = new DefaultExternalEntityResolver(references);
    const result = await resolver.resolve({
      tenantId: DEFAULT_TENANT_ID,
      externalSystemId: EXTERNAL_SYSTEM_ID,
      localEntityType: "machine",
      externalEntityType: "workplace",
      externalId: "300-58140",
    });

    expect(result).toEqual({ status: "matched", localEntityId: "machine-internal-1", matchedBy: "external_reference" });
  });

  it("not_found, když nic neodpovídá a není zadaný businessCode", async () => {
    const references = new IndexedDbExternalReferenceRepository();
    const resolver = new DefaultExternalEntityResolver(references);

    const result = await resolver.resolve({
      tenantId: DEFAULT_TENANT_ID,
      externalSystemId: EXTERNAL_SYSTEM_ID,
      localEntityType: "machine",
      externalEntityType: "workplace",
      externalId: "NEEXISTUJE",
    });

    expect(result).toEqual({ status: "not_found" });
  });

  it("matched přes businessCode, když je zaregistrovaná lookup strategie pro localEntityType", async () => {
    const references = new IndexedDbExternalReferenceRepository();
    const resolver = new DefaultExternalEntityResolver(references, {
      machine: async (tenantId, code) => (code === "PUMA-700" ? "machine-internal-2" : null),
    });

    const result = await resolver.resolve({
      tenantId: DEFAULT_TENANT_ID,
      externalSystemId: EXTERNAL_SYSTEM_ID,
      localEntityType: "machine",
      externalEntityType: "workplace",
      businessCode: "PUMA-700",
    });

    expect(result).toEqual({ status: "matched", localEntityId: "machine-internal-2", matchedBy: "business_code" });
  });

  it("NIKDY automaticky nezaloží novou entitu - jen hlásí not_found", async () => {
    const references = new IndexedDbExternalReferenceRepository();
    const resolver = new DefaultExternalEntityResolver(references, {
      machine: async () => null,
    });

    const result = await resolver.resolve({
      tenantId: DEFAULT_TENANT_ID,
      externalSystemId: EXTERNAL_SYSTEM_ID,
      localEntityType: "machine",
      externalEntityType: "workplace",
      businessCode: "NEZNAMY-KOD",
    });

    expect(result.status).toBe("not_found");
    expect(await references.listByExternalSystem(DEFAULT_TENANT_ID, EXTERNAL_SYSTEM_ID)).toHaveLength(0);
  });

  it("ambiguous, když repository vrátí víc než jednu shodu pro stejné externalId", async () => {
    // Reálná IndexedDbExternalReferenceRepository duplicity sama odmítá
    // (DuplicateExternalReferenceError) - "ambiguous" větev resolveru se proto
    // testuje přes stub repository, který simuluje poškozená/importovaná
    // data odjinud (např. ruční zásah do DB).
    const now = new Date().toISOString();
    const duplicated = [
      ExternalReference.create({
        id: "ref-a",
        tenantId: DEFAULT_TENANT_ID,
        externalSystemId: EXTERNAL_SYSTEM_ID,
        localEntityType: "machine" as const,
        localEntityId: "machine-a",
        externalEntityType: "workplace",
        externalId: "SHARED",
        createdAt: now,
        updatedAt: now,
      }),
      ExternalReference.create({
        id: "ref-b",
        tenantId: DEFAULT_TENANT_ID,
        externalSystemId: EXTERNAL_SYSTEM_ID,
        localEntityType: "machine" as const,
        localEntityId: "machine-b",
        externalEntityType: "workplace",
        externalId: "SHARED",
        createdAt: now,
        updatedAt: now,
      }),
    ];
    const stubRepository = {
      findById: async () => null,
      findByLocalEntity: async () => [],
      findByExternalId: async () => duplicated,
      listByExternalSystem: async () => duplicated,
      save: async () => {},
      delete: async () => {},
    };

    const resolver = new DefaultExternalEntityResolver(stubRepository);
    const result = await resolver.resolve({
      tenantId: DEFAULT_TENANT_ID,
      externalSystemId: EXTERNAL_SYSTEM_ID,
      localEntityType: "machine",
      externalEntityType: "workplace",
      externalId: "SHARED",
    });

    expect(result).toEqual({ status: "ambiguous", candidateIds: ["machine-a", "machine-b"] });
  });
});
