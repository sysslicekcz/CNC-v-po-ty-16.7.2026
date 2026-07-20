import { describe, it, expect, beforeEach } from "vitest";
import { DEFAULT_TENANT_ID } from "@/domain/entities/tenant";
import { deleteTpvDbForTests } from "@/infrastructure/persistence/indexeddb/tpv-db";
import { CalculationRequest } from "@/domain/calculation-engine/entities/calculation-request";
import { CalculationResult } from "@/domain/calculation-engine/entities/calculation-result";
import { CalculationBreakdown } from "@/domain/calculation-engine/entities/calculation-breakdown";
import { RuleVersion } from "@/domain/calculation-engine/rules/rule-version";
import { Time } from "@/domain/calculation-engine/value-objects/time";
import { Quantity } from "@/domain/calculation-engine/value-objects/quantity";
import { IndexedDbCalculationRepository } from "./indexeddb-calculation-repository";
import { IndexedDbRuleRepository } from "./indexeddb-rule-repository";

const OTHER_TENANT_ID = "tenant:other";

function sampleRequest(overrides: Partial<Parameters<typeof CalculationRequest.create>[0]> = {}) {
  return CalculationRequest.create({
    id: "calc-req:1",
    tenantId: DEFAULT_TENANT_ID,
    operationCategory: "manual",
    operationTypeId: "op-type:deburring",
    idempotencyKey: "idem-1",
    inputSnapshot: { quantity: 10 },
    ruleVersionId: "rv:1",
    requestedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  });
}

function sampleBreakdown(): CalculationBreakdown {
  return CalculationBreakdown.createWithDefaults({
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
    quantity: Quantity.ofPieces(10),
    plannedToolChanges: 0,
    plannedFixtureChanges: 0,
  });
}

function sampleResult(overrides: Partial<Parameters<typeof CalculationResult.create>[0]> = {}) {
  return CalculationResult.create({
    id: "calc:1",
    tenantId: DEFAULT_TENANT_ID,
    calculationRequestId: "calc-req:1",
    status: "completed",
    breakdown: sampleBreakdown(),
    confidenceScore: 0.9,
    issues: [],
    engineVersion: "mce-v1",
    strategyVersion: "test-1",
    ruleVersionId: "rv:1",
    calculatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  });
}

describe("IndexedDbCalculationRepository", () => {
  beforeEach(async () => {
    await deleteTpvDbForTests();
  });

  it("uloží a znovu načte CalculationRequest, izolované podle tenanta", async () => {
    const repo = new IndexedDbCalculationRepository();
    await repo.saveRequest(sampleRequest());

    const found = await repo.findRequestById("calc-req:1", DEFAULT_TENANT_ID);
    expect(found?.idempotencyKey).toBe("idem-1");
    expect(found?.inputSnapshot).toEqual({ quantity: 10 });

    expect(await repo.findRequestById("calc-req:1", OTHER_TENANT_ID)).toBeNull();
  });

  it("findRequestByIdempotencyKey najde požadavek podle klíče v rámci tenanta", async () => {
    const repo = new IndexedDbCalculationRepository();
    await repo.saveRequest(sampleRequest());

    expect(await repo.findRequestByIdempotencyKey("idem-1", DEFAULT_TENANT_ID)).not.toBeNull();
    expect(await repo.findRequestByIdempotencyKey("idem-1", OTHER_TENANT_ID)).toBeNull();
    expect(await repo.findRequestByIdempotencyKey("neexistuje", DEFAULT_TENANT_ID)).toBeNull();
  });

  it("uloží a znovu načte CalculationResult včetně kompletního breakdown (round-trip)", async () => {
    const repo = new IndexedDbCalculationRepository();
    const original = sampleResult();
    await repo.saveResult(original);

    const found = await repo.findResultById("calc:1", DEFAULT_TENANT_ID);
    expect(found).not.toBeNull();
    expect(found!.breakdown!.totalOperationTime.minutes).toBeCloseTo(original.breakdown!.totalOperationTime.minutes);
    expect(found!.confidenceScore).toBe(0.9);
  });

  it("findResultsByRequestId vrátí revize nejnovější první", async () => {
    const repo = new IndexedDbCalculationRepository();
    await repo.saveResult(sampleResult({ id: "calc:1", calculatedAt: "2025-01-01T00:00:00.000Z" }));
    await repo.saveResult(sampleResult({ id: "calc:2", calculatedAt: "2025-01-02T00:00:00.000Z" }));

    const results = await repo.findResultsByRequestId("calc-req:1", DEFAULT_TENANT_ID);
    expect(results.map((r) => r.id)).toEqual(["calc:2", "calc:1"]);
  });

  it("failed výsledek (bez breakdown) se uloží a načte správně", async () => {
    const repo = new IndexedDbCalculationRepository();
    await repo.saveResult(
      CalculationResult.create({
        id: "calc:failed",
        tenantId: DEFAULT_TENANT_ID,
        calculationRequestId: "calc-req:1",
        status: "failed",
        issues: [{ code: "MATERIAL_NOT_FOUND", severity: "error", message: "…" }],
        engineVersion: "mce-v1",
        ruleVersionId: "rv:1",
        calculatedAt: "2025-01-01T00:00:00.000Z",
      })
    );

    const found = await repo.findResultById("calc:failed", DEFAULT_TENANT_ID);
    expect(found?.isFailed).toBe(true);
    expect(found?.breakdown).toBeUndefined();
    expect(found?.issues[0].code).toBe("MATERIAL_NOT_FOUND");
  });
});

describe("IndexedDbRuleRepository", () => {
  beforeEach(async () => {
    await deleteTpvDbForTests();
  });

  it("uloží a najde RuleVersion podle id, izolované podle tenanta", async () => {
    const repo = new IndexedDbRuleRepository();
    await repo.save(
      RuleVersion.create({
        id: "rv:1", tenantId: DEFAULT_TENANT_ID, version: "2025-06-01", status: "active",
        publishedAt: "2025-06-01T00:00:00.000Z", constants: { "default.percentageAllowance": 0.1 },
      })
    );

    const found = await repo.findById("rv:1", DEFAULT_TENANT_ID);
    expect(found?.getConstant("default.percentageAllowance", 0)).toBeCloseTo(0.1);
    expect(await repo.findById("rv:1", OTHER_TENANT_ID)).toBeNull();
  });

  it("findActiveVersion najde jedinou verzi se status 'active'", async () => {
    const repo = new IndexedDbRuleRepository();
    await repo.save(
      RuleVersion.create({
        id: "rv:old", tenantId: DEFAULT_TENANT_ID, version: "1", status: "retired",
        publishedAt: "2025-01-01T00:00:00.000Z", constants: {},
      })
    );
    await repo.save(
      RuleVersion.create({
        id: "rv:new", tenantId: DEFAULT_TENANT_ID, version: "2", status: "active",
        publishedAt: "2025-06-01T00:00:00.000Z", constants: {},
      })
    );

    const active = await repo.findActiveVersion(DEFAULT_TENANT_ID);
    expect(active?.id).toBe("rv:new");
  });

  it("findActiveVersion vrátí null, pokud žádná verze není aktivní", async () => {
    const repo = new IndexedDbRuleRepository();
    expect(await repo.findActiveVersion(DEFAULT_TENANT_ID)).toBeNull();
  });
});
