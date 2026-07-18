import { describe, it, expect, beforeEach } from "vitest";
import { ExternalSystem } from "@/domain/integrations/external-system";
import { ExternalReference } from "@/domain/integrations/external-reference";
import { DEFAULT_TENANT_ID } from "@/domain/entities/tenant";
import { DuplicateExternalReferenceError } from "@/domain/errors/duplicate-external-reference-error";
import { IndexedDbExternalSystemRepository } from "./indexeddb-external-system-repository";
import { IndexedDbExternalReferenceRepository } from "./indexeddb-external-reference-repository";
import { deleteTpvDbForTests } from "../tpv-db";

describe("ExternalSystem + ExternalReference (ERP-neutrální integrační vrstva)", () => {
  beforeEach(async () => {
    await deleteTpvDbForTests();
  });

  it("jeden tenant může mít víc externích systémů libovolného connectorType", async () => {
    const systems = new IndexedDbExternalSystemRepository();

    await systems.save(
      ExternalSystem.create({
        id: "sys-erp",
        tenantId: DEFAULT_TENANT_ID,
        code: "ERP-1",
        name: "Hlavní ERP",
        type: "erp",
        connectorType: "helios",
        status: "active",
      })
    );
    await systems.save(
      ExternalSystem.create({
        id: "sys-mes",
        tenantId: DEFAULT_TENANT_ID,
        code: "MES-1",
        name: "Dílenský MES",
        type: "mes",
        connectorType: "custom-rest",
        status: "active",
      })
    );

    const all = await systems.list(DEFAULT_TENANT_ID);
    expect(all).toHaveLength(2);
    expect(new Set(all.map((s) => s.connectorType))).toEqual(new Set(["helios", "custom-rest"]));
  });

  it("jedna lokální entita (Machine.id) může mít reference ve VÍC externích systémech současně", async () => {
    const systems = new IndexedDbExternalSystemRepository();
    const references = new IndexedDbExternalReferenceRepository();

    const erpA = ExternalSystem.create({
      id: "sys-a",
      tenantId: DEFAULT_TENANT_ID,
      code: "A",
      name: "Systém A",
      type: "erp",
      connectorType: "helios",
      status: "active",
    });
    const erpB = ExternalSystem.create({
      id: "sys-b",
      tenantId: DEFAULT_TENANT_ID,
      code: "B",
      name: "Systém B",
      type: "mes",
      connectorType: "custom-rest",
      status: "active",
    });
    await systems.save(erpA);
    await systems.save(erpB);

    const localMachineId = "machine-internal-id-1";
    const now = new Date().toISOString();

    await references.save(
      ExternalReference.create({
        id: "ref-a",
        tenantId: DEFAULT_TENANT_ID,
        externalSystemId: erpA.id,
        localEntityType: "machine",
        localEntityId: localMachineId,
        externalEntityType: "workplace",
        externalId: "300-58140",
        createdAt: now,
        updatedAt: now,
      })
    );
    await references.save(
      ExternalReference.create({
        id: "ref-b",
        tenantId: DEFAULT_TENANT_ID,
        externalSystemId: erpB.id,
        localEntityType: "machine",
        localEntityId: localMachineId,
        externalEntityType: "resource",
        externalId: "MES-RES-9",
        createdAt: now,
        updatedAt: now,
      })
    );

    const refsForMachine = await references.findByLocalEntity(DEFAULT_TENANT_ID, "machine", localMachineId);
    expect(refsForMachine).toHaveLength(2);
    expect(new Set(refsForMachine.map((r) => r.externalSystemId))).toEqual(new Set([erpA.id, erpB.id]));
  });

  it("stejné externalId smí nezávisle existovat ve DVOU RŮZNÝCH externích systémech bez konfliktu", async () => {
    const systems = new IndexedDbExternalSystemRepository();
    const references = new IndexedDbExternalReferenceRepository();

    const erpA = ExternalSystem.create({
      id: "sys-a",
      tenantId: DEFAULT_TENANT_ID,
      code: "A",
      name: "Systém A",
      type: "erp",
      connectorType: "helios",
      status: "active",
    });
    const erpB = ExternalSystem.create({
      id: "sys-b",
      tenantId: DEFAULT_TENANT_ID,
      code: "B",
      name: "Systém B",
      type: "erp",
      connectorType: "sap",
      status: "active",
    });
    await systems.save(erpA);
    await systems.save(erpB);

    const now = new Date().toISOString();
    const sharedExternalId = "0001";

    await expect(
      references.save(
        ExternalReference.create({
          id: "ref-in-a",
          tenantId: DEFAULT_TENANT_ID,
          externalSystemId: erpA.id,
          localEntityType: "machine",
          localEntityId: "machine-1",
          externalEntityType: "workplace",
          externalId: sharedExternalId,
          createdAt: now,
          updatedAt: now,
        })
      )
    ).resolves.not.toThrow();

    await expect(
      references.save(
        ExternalReference.create({
          id: "ref-in-b",
          tenantId: DEFAULT_TENANT_ID,
          externalSystemId: erpB.id,
          localEntityType: "machine",
          localEntityId: "machine-2",
          externalEntityType: "workplace",
          externalId: sharedExternalId,
          createdAt: now,
          updatedAt: now,
        })
      )
    ).resolves.not.toThrow();
  });

  it("stejné externalId DVAKRÁT ve STEJNÉM systému+entitním typu je konflikt (DuplicateExternalReferenceError)", async () => {
    const systems = new IndexedDbExternalSystemRepository();
    const references = new IndexedDbExternalReferenceRepository();

    const erpA = ExternalSystem.create({
      id: "sys-a",
      tenantId: DEFAULT_TENANT_ID,
      code: "A",
      name: "Systém A",
      type: "erp",
      connectorType: "helios",
      status: "active",
    });
    await systems.save(erpA);

    const now = new Date().toISOString();
    await references.save(
      ExternalReference.create({
        id: "ref-1",
        tenantId: DEFAULT_TENANT_ID,
        externalSystemId: erpA.id,
        localEntityType: "machine",
        localEntityId: "machine-1",
        externalEntityType: "workplace",
        externalId: "DUP-1",
        createdAt: now,
        updatedAt: now,
      })
    );

    await expect(
      references.save(
        ExternalReference.create({
          id: "ref-2",
          tenantId: DEFAULT_TENANT_ID,
          externalSystemId: erpA.id,
          localEntityType: "machine",
          localEntityId: "machine-2",
          externalEntityType: "workplace",
          externalId: "DUP-1",
          createdAt: now,
          updatedAt: now,
        })
      )
    ).rejects.toThrow(DuplicateExternalReferenceError);
  });

  it("odebrání licence konektoru nesmaže už importovaná ExternalReference data - repository na licenci vůbec nezávisí", async () => {
    const systems = new IndexedDbExternalSystemRepository();
    const references = new IndexedDbExternalReferenceRepository();

    const erpA = ExternalSystem.create({
      id: "sys-a",
      tenantId: DEFAULT_TENANT_ID,
      code: "A",
      name: "Systém A",
      type: "erp",
      connectorType: "helios",
      status: "active",
    });
    await systems.save(erpA);

    const now = new Date().toISOString();
    await references.save(
      ExternalReference.create({
        id: "ref-imported",
        tenantId: DEFAULT_TENANT_ID,
        externalSystemId: erpA.id,
        localEntityType: "machine",
        localEntityId: "machine-1",
        externalEntityType: "workplace",
        externalId: "IMPORTED-1",
        createdAt: now,
        updatedAt: now,
      })
    );

    // Simulace "licence konektoru byla odebrána" - v appce by to znamenalo, že
    // FeatureAccessService.require("connector.helios", ...) začne házet
    // FeatureNotLicensedError. Repository samo o sobě žádnou kontrolu licence
    // nevolá a neprovádí - data zůstávají čitelná bez ohledu na licenci.
    const stillThere = await references.findById("ref-imported", DEFAULT_TENANT_ID);
    expect(stillThere).not.toBeNull();
    expect(stillThere?.externalId).toBe("IMPORTED-1");
  });
});
