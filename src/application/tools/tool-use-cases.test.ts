import { describe, it, expect, beforeEach } from "vitest";
import { CreateToolTypeUseCase } from "./create-tool-type-use-case";
import { DeactivateToolTypeUseCase } from "./deactivate-tool-type-use-case";
import { CreateToolUseCase } from "./create-tool-use-case";
import { UpdateToolUseCase } from "./update-tool-use-case";
import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCode } from "@/domain/licensing/feature-code";
import { FeatureAccess } from "@/domain/licensing/feature-access";
import { LicenseLimitCode } from "@/domain/licensing/license-limit-code";
import { FeatureNotLicensedError, LicenseLimitExceededError } from "@/domain/errors/license-errors";
import { MasterDataCodeAlreadyExistsError, InvalidMasterDataValueError, MasterDataInactiveError } from "@/domain/errors/master-data-errors";
import { NotFoundError } from "@/domain/errors/not-found-error";
import { ValidationError } from "@/domain/errors/validation-error";
import { IndexedDbToolTypeRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-tool-type-repository";
import { IndexedDbToolRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-tool-repository";
import { deleteTpvDbForTests } from "@/infrastructure/persistence/indexeddb/tpv-db";

const TENANT_ID = "tenant:tool-use-cases";

function tenantContext(): TenantContext {
  return { getCurrentTenantId: () => TENANT_ID, requireCurrentTenantId: () => TENANT_ID };
}

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

describe("CreateToolTypeUseCase", () => {
  beforeEach(async () => {
    await deleteTpvDbForTests();
  });

  it("zamítne duplicitní klíč parametru v definici typu", async () => {
    const repo = new IndexedDbToolTypeRepository();
    const useCase = new CreateToolTypeUseCase(tenantContext(), repo, stubFeatureAccessService());
    await expect(
      useCase.execute({
        kod: "TT-1",
        nazev: "Vrták",
        category: "drill",
        parameterDefinitions: [
          { key: "diameter", name: "Průměr", valueType: "number", required: true },
          { key: "diameter", name: "Duplicitní", valueType: "text", required: false },
        ],
      })
    ).rejects.toThrow(ValidationError);
  });

  it("'selection' bez allowedValues na Tool se odmítne až při přiřazení hodnoty (typ sám o sobě nevaliduje allowedValues u parametrů)", async () => {
    const repo = new IndexedDbToolTypeRepository();
    const useCase = new CreateToolTypeUseCase(tenantContext(), repo, stubFeatureAccessService());
    const created = await useCase.execute({
      kod: "TT-1",
      nazev: "Fréza",
      category: "milling_cutter",
      parameterDefinitions: [{ key: "coating", name: "Povlak", valueType: "selection", required: true, allowedValues: ["TiN", "TiAlN"] }],
    });
    expect(created.parameterDefinitions).toHaveLength(1);
  });
});

describe("CreateToolUseCase - validace dynamických parametrů proti ToolType", () => {
  beforeEach(async () => {
    await deleteTpvDbForTests();
  });

  it("založí nástroj s validními parametry podle definice typu", async () => {
    const toolTypeRepo = new IndexedDbToolTypeRepository();
    const toolRepo = new IndexedDbToolRepository();
    const fas = stubFeatureAccessService();

    const toolType = await new CreateToolTypeUseCase(tenantContext(), toolTypeRepo, fas).execute({
      kod: "TT-1",
      nazev: "Vrták",
      category: "drill",
      parameterDefinitions: [{ key: "diameter", name: "Průměr", valueType: "number", unit: "mm", required: true }],
    });

    const tool = await new CreateToolUseCase(tenantContext(), toolRepo, toolTypeRepo, fas).execute({
      nazev: "Vrták 8mm",
      toolTypeId: toolType.id,
      parameters: { diameter: 8 },
    });
    expect(tool.parameters?.diameter).toBe(8);
  });

  it("zamítne chybějící povinný parametr", async () => {
    const toolTypeRepo = new IndexedDbToolTypeRepository();
    const toolRepo = new IndexedDbToolRepository();
    const fas = stubFeatureAccessService();

    const toolType = await new CreateToolTypeUseCase(tenantContext(), toolTypeRepo, fas).execute({
      kod: "TT-1",
      nazev: "Vrták",
      category: "drill",
      parameterDefinitions: [{ key: "diameter", name: "Průměr", valueType: "number", required: true }],
    });

    await expect(
      new CreateToolUseCase(tenantContext(), toolRepo, toolTypeRepo, fas).execute({ nazev: "Vrták bez průměru", toolTypeId: toolType.id })
    ).rejects.toThrow(InvalidMasterDataValueError);
  });

  it("zamítne parametr se špatným datovým typem", async () => {
    const toolTypeRepo = new IndexedDbToolTypeRepository();
    const toolRepo = new IndexedDbToolRepository();
    const fas = stubFeatureAccessService();

    const toolType = await new CreateToolTypeUseCase(tenantContext(), toolTypeRepo, fas).execute({
      kod: "TT-1",
      nazev: "Vrták",
      category: "drill",
      parameterDefinitions: [{ key: "diameter", name: "Průměr", valueType: "number", required: true }],
    });

    await expect(
      new CreateToolUseCase(tenantContext(), toolRepo, toolTypeRepo, fas).execute({
        nazev: "Vrták",
        toolTypeId: toolType.id,
        parameters: { diameter: "osm" as unknown as number },
      })
    ).rejects.toThrow(InvalidMasterDataValueError);
  });

  it("zamítne hodnotu mimo allowedValues u 'selection' parametru", async () => {
    const toolTypeRepo = new IndexedDbToolTypeRepository();
    const toolRepo = new IndexedDbToolRepository();
    const fas = stubFeatureAccessService();

    const toolType = await new CreateToolTypeUseCase(tenantContext(), toolTypeRepo, fas).execute({
      kod: "TT-1",
      nazev: "Fréza",
      category: "milling_cutter",
      parameterDefinitions: [{ key: "coating", name: "Povlak", valueType: "selection", required: true, allowedValues: ["TiN", "TiAlN"] }],
    });

    await expect(
      new CreateToolUseCase(tenantContext(), toolRepo, toolTypeRepo, fas).execute({
        nazev: "Fréza",
        toolTypeId: toolType.id,
        parameters: { coating: "Zlato" },
      })
    ).rejects.toThrow(InvalidMasterDataValueError);
  });

  it("zamítne založení nástroje na NEAKTIVNÍM typu nástroje", async () => {
    const toolTypeRepo = new IndexedDbToolTypeRepository();
    const toolRepo = new IndexedDbToolRepository();
    const fas = stubFeatureAccessService();

    const toolType = await new CreateToolTypeUseCase(tenantContext(), toolTypeRepo, fas).execute({ kod: "TT-1", nazev: "Vrták", category: "drill" });
    await new DeactivateToolTypeUseCase(tenantContext(), toolTypeRepo, fas).execute(toolType.id);

    await expect(
      new CreateToolUseCase(tenantContext(), toolRepo, toolTypeRepo, fas).execute({ nazev: "Vrták", toolTypeId: toolType.id })
    ).rejects.toThrow(MasterDataInactiveError);
  });

  it("zamítne duplicitní kód nástroje v rámci tenanta", async () => {
    const toolTypeRepo = new IndexedDbToolTypeRepository();
    const toolRepo = new IndexedDbToolRepository();
    const fas = stubFeatureAccessService();
    const toolType = await new CreateToolTypeUseCase(tenantContext(), toolTypeRepo, fas).execute({ kod: "TT-1", nazev: "Vrták", category: "drill" });
    const create = new CreateToolUseCase(tenantContext(), toolRepo, toolTypeRepo, fas);

    await create.execute({ code: "TOOL-1", nazev: "Vrták A", toolTypeId: toolType.id });
    await expect(create.execute({ code: "TOOL-1", nazev: "Vrták B", toolTypeId: toolType.id })).rejects.toThrow(MasterDataCodeAlreadyExistsError);
  });

  it("zamítne nad licenčním limitem 'tools.max'", async () => {
    const toolTypeRepo = new IndexedDbToolTypeRepository();
    const toolRepo = new IndexedDbToolRepository();
    const fas = stubFeatureAccessService({ limit: 1 });
    const toolType = await new CreateToolTypeUseCase(tenantContext(), toolTypeRepo, stubFeatureAccessService()).execute({
      kod: "TT-1",
      nazev: "Vrták",
      category: "drill",
    });
    const create = new CreateToolUseCase(tenantContext(), toolRepo, toolTypeRepo, fas);
    await create.execute({ nazev: "Vrták A", toolTypeId: toolType.id });
    await expect(create.execute({ nazev: "Vrták B", toolTypeId: toolType.id })).rejects.toThrow(LicenseLimitExceededError);
  });
});

describe("UpdateToolUseCase - přepnutí typu nezahazuje parametry bez potvrzení", () => {
  beforeEach(async () => {
    await deleteTpvDbForTests();
  });

  it("po přepnutí typu se PŮVODNÍ parametry re-validují proti NOVÉ definici", async () => {
    const toolTypeRepo = new IndexedDbToolTypeRepository();
    const toolRepo = new IndexedDbToolRepository();
    const fas = stubFeatureAccessService();

    const typeA = await new CreateToolTypeUseCase(tenantContext(), toolTypeRepo, fas).execute({
      kod: "TT-A",
      nazev: "Vrták",
      category: "drill",
      parameterDefinitions: [{ key: "diameter", name: "Průměr", valueType: "number", required: true }],
    });
    const typeB = await new CreateToolTypeUseCase(tenantContext(), toolTypeRepo, fas).execute({
      kod: "TT-B",
      nazev: "Závitník",
      category: "tap",
      parameterDefinitions: [{ key: "pitch", name: "Stoupání", valueType: "number", required: true }],
    });

    const tool = await new CreateToolUseCase(tenantContext(), toolRepo, toolTypeRepo, fas).execute({
      nazev: "Nástroj",
      toolTypeId: typeA.id,
      parameters: { diameter: 8 },
    });

    const update = new UpdateToolUseCase(tenantContext(), toolRepo, toolTypeRepo, fas);
    // Přepnutí typu BEZ nových parametrů - staré 'diameter' neodpovídá nové definici 'pitch' (povinný, chybí).
    await expect(update.execute(tool.id, { toolTypeId: typeB.id })).rejects.toThrow(InvalidMasterDataValueError);

    // Explicitní dodání nových parametrů projde.
    const updated = await update.execute(tool.id, { toolTypeId: typeB.id, parameters: { pitch: 1.5 } });
    expect(updated.toolTypeId).toBe(typeB.id);
    expect(updated.parameters?.pitch).toBe(1.5);
  });

  it("vyhodí NotFoundError pro neexistující nástroj", async () => {
    const toolTypeRepo = new IndexedDbToolTypeRepository();
    const toolRepo = new IndexedDbToolRepository();
    const fas = stubFeatureAccessService();
    await expect(new UpdateToolUseCase(tenantContext(), toolRepo, toolTypeRepo, fas).execute("neexistuje", { nazev: "X" })).rejects.toThrow(
      NotFoundError
    );
  });
});
