import { describe, it, expect, beforeEach } from "vitest";
import { TenantContext } from "@/domain/services/tenant-context";
import { DEFAULT_TENANT_ID } from "@/domain/entities/tenant";
import { Material } from "@/domain/entities/material";
import { MaterialCode } from "@/domain/value-objects/material-code";
import { Machine } from "@/domain/entities/machine";
import { MachineCode } from "@/domain/value-objects/machine-code";
import { HourlyRate } from "@/domain/value-objects/hourly-rate";
import { deleteTpvDbForTests } from "@/infrastructure/persistence/indexeddb/tpv-db";
import { IndexedDbMaterialRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-material-repository";
import { IndexedDbMachineRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-machine-repository";
import { IndexedDbToolRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-tool-repository";
import { IndexedDbCalculationRepository } from "@/infrastructure/calculation-engine/indexeddb-calculation-repository";
import { IndexedDbRuleRepository } from "@/infrastructure/calculation-engine/indexeddb-rule-repository";
import { RuleVersion } from "@/domain/calculation-engine/rules/rule-version";
import { InMemoryCalculationStrategyRegistry } from "@/domain/calculation-engine/services/calculation-strategy-registry";
import { DefaultCalculationEngine } from "@/domain/calculation-engine/services/calculation-engine";
import { CalculationStrategy } from "@/domain/calculation-engine/services/calculation-strategy";
import { CalculationBreakdown } from "@/domain/calculation-engine/entities/calculation-breakdown";
import { Time } from "@/domain/calculation-engine/value-objects/time";
import { Quantity } from "@/domain/calculation-engine/value-objects/quantity";
import { NotFoundError } from "@/domain/errors/not-found-error";
import { MaterialError } from "@/domain/calculation-engine/errors/material-error";
import { ToolError } from "@/domain/calculation-engine/errors/tool-error";
import { CalculationError } from "@/domain/calculation-engine/errors/calculation-error";
import { CalculateOperationUseCase } from "./calculate-operation-use-case";
import { OperationCalculationInput } from "../dto/operation-calculation-input";

function tenantContext(): TenantContext {
  return { getCurrentTenantId: () => DEFAULT_TENANT_ID, requireCurrentTenantId: () => DEFAULT_TENANT_ID };
}

function trivialManualStrategy(): CalculationStrategy {
  return {
    operationCategory: "manual",
    strategyVersion: "manual-test-1",
    validate: (input) => (input.quantity <= 0 ? [{ code: "INVALID_QUANTITY", severity: "error", message: "…" }] : []),
    calculate: (input) =>
      CalculationBreakdown.createWithDefaults({
        rawUnitTime: Time.ofMinutes(2),
        setupTime: Time.ofMinutes(5),
        firstPieceInspectionTime: Time.zero(),
        finalInspectionTime: Time.zero(),
        toolChangeTime: Time.zero(),
        fixtureChangeTime: Time.zero(),
        handlingTime: Time.zero(),
        inOperationInspectionTime: Time.zero(),
        measurementTime: Time.zero(),
        interOperationMoveTime: Time.zero(),
        auxiliaryTime: Time.zero(),
        waitingTime: Time.zero(),
        quantity: Quantity.ofPieces(input.quantity),
        plannedToolChanges: 0,
        plannedFixtureChanges: 0,
      }),
  };
}

async function seedMaterial(id: string) {
  await new IndexedDbMaterialRepository().save(
    Material.create({
      id, tenantId: DEFAULT_TENANT_ID, code: MaterialCode.create("MAT-1"), name: "Ocel 11 523",
      materialGroupId: "material-group:1", status: "active",
    })
  );
}

async function seedMachine(id: string) {
  await new IndexedDbMachineRepository().save(
    Machine.create({
      id, tenantId: DEFAULT_TENANT_ID, code: MachineCode.create("STROJ-1"), name: "Universal",
      hourlyRate: HourlyRate.of(800, "CZK"), status: "active",
    })
  );
}

async function seedActiveRuleVersion() {
  await new IndexedDbRuleRepository().save(
    RuleVersion.create({
      id: "rv:active", tenantId: DEFAULT_TENANT_ID, version: "2025-06-01", status: "active",
      publishedAt: "2025-06-01T00:00:00.000Z", constants: {},
    })
  );
}

function buildUseCase(registry = new InMemoryCalculationStrategyRegistry()) {
  registry.register(trivialManualStrategy());
  return new CalculateOperationUseCase(
    tenantContext(),
    new IndexedDbCalculationRepository(),
    new IndexedDbRuleRepository(),
    new IndexedDbMaterialRepository(),
    new IndexedDbMachineRepository(),
    new IndexedDbToolRepository(),
    new DefaultCalculationEngine(registry)
  );
}

const baseInput: OperationCalculationInput = {
  operationCategory: "manual",
  operationTypeId: "op-type:deburring",
  quantity: 10,
  materialId: "material:1",
  idempotencyKey: "idem-1",
};

describe("CalculateOperationUseCase - Fáze A acceptance: round-trips a trivial manual operation", () => {
  beforeEach(async () => {
    await deleteTpvDbForTests();
    await seedMaterial("material:1");
    await seedActiveRuleVersion();
  });

  it("spočítá operaci, uloží CalculationRequest i CalculationResult a vrátí OperationCalculationOutput", async () => {
    const output = await buildUseCase().execute(baseInput);

    expect(output.status).toBe("completed");
    expect(output.engineVersion).toBe("mce-v1");
    expect(output.ruleVersionId).toBe("rv:active");
    expect(output.finalOperationTimeMinutes).toBeCloseTo(5 + 10 * 2); // setup 5 + 10 ks × 2 min
    expect(output.breakdown).toBeDefined();
    expect(output.issues).toEqual([]);

    const persistedRequest = await new IndexedDbCalculationRepository().findRequestById(output.calculationRequestId, DEFAULT_TENANT_ID);
    expect(persistedRequest?.idempotencyKey).toBe("idem-1");
    const persistedResult = await new IndexedDbCalculationRepository().findResultById(output.calculationId, DEFAULT_TENANT_ID);
    expect(persistedResult?.status).toBe("completed");
  });

  it("opakované volání se stejným idempotencyKey vrátí PŮVODNÍ výsledek, nepočítá znovu", async () => {
    const useCase = buildUseCase();
    const first = await useCase.execute(baseInput);
    const second = await useCase.execute(baseInput);

    expect(second.calculationId).toBe(first.calculationId);
  });

  it("vyhodí MaterialError, pokud materiál neexistuje", async () => {
    await expect(buildUseCase().execute({ ...baseInput, materialId: "material:neexistuje", idempotencyKey: "idem-2" })).rejects.toThrow(
      MaterialError
    );
  });

  it("vyhodí NotFoundError, pokud uvedený stroj neexistuje", async () => {
    await expect(
      buildUseCase().execute({ ...baseInput, machineId: "machine:neexistuje", idempotencyKey: "idem-3" })
    ).rejects.toThrow(NotFoundError);
  });

  it("vyhodí ToolError, pokud uvedený nástroj neexistuje", async () => {
    await expect(
      buildUseCase().execute({ ...baseInput, toolId: "tool:neexistuje", idempotencyKey: "idem-4" })
    ).rejects.toThrow(ToolError);
  });

  it("projde, pokud existující stroj JE uveden", async () => {
    await seedMachine("machine:1");
    const output = await buildUseCase().execute({ ...baseInput, machineId: "machine:1", idempotencyKey: "idem-5" });
    expect(output.status).toBe("completed");
  });

  it("vyhodí CalculationError, pokud pro tenanta neexistuje žádná aktivní verze pravidel", async () => {
    await deleteTpvDbForTests();
    await seedMaterial("material:1"); // bez seedActiveRuleVersion()
    await expect(buildUseCase().execute({ ...baseInput, idempotencyKey: "idem-6" })).rejects.toThrow(CalculationError);
  });

  it("uloží CalculationResult se status 'failed' a bez breakdown, pokud strategie validaci zablokuje", async () => {
    const output = await buildUseCase().execute({ ...baseInput, quantity: 0, idempotencyKey: "idem-7" });

    expect(output.status).toBe("failed");
    expect(output.breakdown).toBeUndefined();
    expect(output.finalOperationTimeMinutes).toBeUndefined();
    expect(output.issues[0].code).toBe("INVALID_QUANTITY");
  });
});
