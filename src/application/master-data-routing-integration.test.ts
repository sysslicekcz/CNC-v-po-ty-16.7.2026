import { describe, it, expect, beforeEach } from "vitest";

import { CreateCapacityGroupUseCase } from "./capacity-groups/create-capacity-group-use-case";
import { CreateMachineUseCase } from "./machines/create-machine-use-case";
import { UpdateMachineUseCase } from "./machines/update-machine-use-case";
import { AssignMachineToCapacityGroupUseCase } from "./machines/assign-machine-to-capacity-group-use-case";
import { AssignMachineCapabilityUseCase } from "./machines/assign-machine-capability-use-case";
import { CreateOperationTypeUseCase } from "./operation-types/create-operation-type-use-case";
import { CreateCapabilityTypeUseCase } from "./capabilities/create-capability-type-use-case";
import { ConfigureOperationTypeCapabilitiesUseCase } from "./operation-types/configure-operation-type-capabilities-use-case";
import { CreateToolTypeUseCase } from "./tools/create-tool-type-use-case";
import { CreateToolUseCase } from "./tools/create-tool-use-case";
import { CreateToolMachineConditionUseCase } from "./cutting-conditions/create-tool-machine-condition-use-case";
import { ResolveCuttingConditionUseCase } from "./cutting-conditions/resolve-cutting-condition-use-case";
import { CreateRoutingSheetUseCase } from "./routing-sheets/create-routing-sheet-use-case";
import { SaveRoutingSheetDraftUseCase } from "./routing-sheets/save-routing-sheet-draft-use-case";
import { CalculateOperationUseCase } from "./routing-sheets/calculate-operation-use-case";

import { Part } from "@/domain/entities/part";
import { Quantity } from "@/domain/value-objects/quantity";
import { HourlyRate } from "@/domain/value-objects/hourly-rate";
import { CuttingParameters } from "@/domain/value-objects/cutting-parameters";
import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";

import { IndexedDbCapacityGroupRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-capacity-group-repository";
import { IndexedDbMachineRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-machine-repository";
import { IndexedDbMachineCapabilityRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-machine-capability-repository";
import { IndexedDbOperationTypeRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-operation-type-repository";
import { IndexedDbCapabilityTypeRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-capability-type-repository";
import { IndexedDbOperationTypeCapabilityRequirementRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-operation-type-capability-requirement-repository";
import { IndexedDbToolTypeRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-tool-type-repository";
import { IndexedDbToolRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-tool-repository";
import { IndexedDbToolMachineConditionRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-tool-machine-condition-repository";
import { IndexedDbPartRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-part-repository";
import { IndexedDbRoutingSheetRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-routing-sheet-repository";
import { LegacyCalculationEngine } from "@/infrastructure/calculation/legacy-calculation-engine";
import { deleteTpvDbForTests } from "@/infrastructure/persistence/indexeddb/tpv-db";

const TENANT_ID = "tenant:master-data-routing-integration";

function tenantContext(): TenantContext {
  return { getCurrentTenantId: () => TENANT_ID, requireCurrentTenantId: () => TENANT_ID };
}

/** Stejný vzor jako machine-use-cases.test.ts/routing-sheet-use-cases.test.ts -
 *  plný přístup, žádné omezení licencí (tenhle test ověřuje PROPOJENÍ Kroku 5
 *  s Krokem 4, ne licencování samotné - to mají svoje vlastní testy). */
function fullFeatureAccessService(): FeatureAccessService {
  return {
    getAccess: async () => "full",
    canUse: async () => true,
    require: async () => {},
    getLimit: async () => null,
    assertWithinLimit: async () => {},
  };
}

/**
 * Jeden ucelený "golden path" integrační test napříč Krokem 5 (kmenová data) a
 * Krokem 4 (editor + kalkulace) - zadání Kroku 5, sekce 61-73 ("jeden plně
 * integrační test"). Ověřuje, že:
 *  1. Kmenová data (skupina kapacity -> stroj -> capability -> typ operace ->
 *     požadavek na capabilitu -> nástroj -> řezné podmínky) se dají sestavit
 *     jen přes application use casy, nikdy přímým zápisem do IndexedDB.
 *  2. Editor postupu (Krok 4) tahle data skutečně POUŽÍVÁ (přiřazení stroje k
 *     operaci, nástroje k činnosti, výpočet přes existující kalkulační engine).
 *  3. Kalkulační snapshot je ZAMRZLÝ v okamžiku výpočtu (docs/adr/0006) -
 *     následná změna hodinové sazby stroje (kmenová data) NEMĚNÍ už zapsaný
 *     snapshot starší kalkulace (docs/adr/calculation-snapshots-do-not-follow-master-data-changes.md).
 */
describe("Integrace: kmenová data (Krok 5) -> editor postupu a kalkulace (Krok 4)", () => {
  beforeEach(async () => {
    await deleteTpvDbForTests();
  });

  it("kmenová data sestavená přes use casy se skutečně použijí v postupu a kalkulaci; změna sazby po výpočtu nezmění starý snapshot", async () => {
    const ctx = tenantContext();
    const fas = fullFeatureAccessService();

    // 1) Skupina kapacity + stroj
    const capacityGroupRepo = new IndexedDbCapacityGroupRepository();
    const capacityGroup = await new CreateCapacityGroupUseCase(ctx, capacityGroupRepo, fas).execute({
      code: "CAP-INTEG",
      name: "Integrační skupina kapacity",
    });

    const machineRepo = new IndexedDbMachineRepository();
    const machine = await new CreateMachineUseCase(ctx, machineRepo, fas).execute({
      code: "M-INTEG",
      name: "Integrační soustruh",
      hourlyRate: HourlyRate.of(1000, "CZK"),
    });
    await new AssignMachineToCapacityGroupUseCase(ctx, machineRepo, capacityGroupRepo, fas).execute(machine.id, capacityGroup.id);
    const machineWithGroup = await machineRepo.findById(machine.id, TENANT_ID);
    expect(machineWithGroup?.capacityGroupId).toBe(capacityGroup.id);

    // 2) Typ operace + typ vlastnosti + capability stroje + požadavek typu operace
    const operationTypeRepo = new IndexedDbOperationTypeRepository();
    const operationType = await new CreateOperationTypeUseCase(ctx, operationTypeRepo, fas).execute({
      kod: "OP-INTEG",
      nazev: "Podélné soustružení (integrace)",
      kategorie: "turning",
      resourceRequirement: "machine",
      requiresSetupTime: true,
      requiresUnitTime: true,
    });

    const capabilityTypeRepo = new IndexedDbCapabilityTypeRepository();
    const capabilityType = await new CreateCapabilityTypeUseCase(ctx, capabilityTypeRepo, fas).execute({
      code: "MAX_TURNING_DIAMETER",
      name: "Max. průměr soustružení",
      valueType: "number",
      unit: "mm",
    });

    const machineCapabilityRepo = new IndexedDbMachineCapabilityRepository();
    await new AssignMachineCapabilityUseCase(ctx, machineCapabilityRepo, machineRepo, operationTypeRepo, fas).execute({
      machineId: machine.id,
      operationTypeId: operationType.id,
    });
    const capabilities = await machineCapabilityRepo.findByMachineId(machine.id, TENANT_ID);
    expect(capabilities.some((c) => c.operationTypeId === operationType.id && c.enabled)).toBe(true);

    const requirementRepo = new IndexedDbOperationTypeCapabilityRequirementRepository();
    await new ConfigureOperationTypeCapabilitiesUseCase(ctx, requirementRepo, operationTypeRepo, capabilityTypeRepo, fas).execute({
      operationTypeId: operationType.id,
      capabilityTypeId: capabilityType.id,
      requirement: "required",
      expectedValue: 300,
    });
    const requirements = await requirementRepo.findByOperationTypeId(operationType.id, TENANT_ID);
    expect(requirements).toHaveLength(1);

    // 3) Typ nástroje + nástroj + řezné podmínky (nástroj na stroji pro daný typ operace)
    const toolTypeRepo = new IndexedDbToolTypeRepository();
    const toolType = await new CreateToolTypeUseCase(ctx, toolTypeRepo, fas).execute({
      kod: "TT-INTEG",
      nazev: "Soustružnický nůž (integrace)",
      category: "turning_holder",
    });

    const toolRepo = new IndexedDbToolRepository();
    const tool = await new CreateToolUseCase(ctx, toolRepo, toolTypeRepo, fas).execute({
      code: "T-INTEG",
      nazev: "Nůž VBD 55°",
      toolTypeId: toolType.id,
    });

    const conditionRepo = new IndexedDbToolMachineConditionRepository();
    await new CreateToolMachineConditionUseCase(ctx, conditionRepo, toolRepo, machineRepo, fas).execute({
      toolId: tool.id,
      machineId: machine.id,
      operationTypeId: operationType.id,
      parameters: CuttingParameters.of({ vc: 200, feed: 0.25, ap: 2 }),
      source: "internal",
    });

    const resolved = await new ResolveCuttingConditionUseCase(ctx, toolRepo, conditionRepo, fas).execute({
      toolId: tool.id,
      machineId: machine.id,
      operationTypeId: operationType.id,
    });
    expect(resolved?.vc).toBe(200);

    // 4) Postup (Krok 4): založ díl + draft, přiřaď stroj k operaci, nástroj k činnosti
    const part = Part.create({ id: "part-integ", orderId: "order-integ", nazev: "Integrační díl", mnozstvi: Quantity.of(1, "ks"), cisloVykresu: "V-INTEG" });
    await new IndexedDbPartRepository().save(part);

    const routingSheetRepo = new IndexedDbRoutingSheetRepository();
    const routingSheet = await new CreateRoutingSheetUseCase(ctx, routingSheetRepo, new IndexedDbPartRepository(), fas).execute({
      partId: part.id,
    });

    const operation = routingSheet.addOperation({ id: "op-1", nazev: "Soustružení", machineId: machine.id });
    const position = routingSheet.addPosition(operation.id, { id: "pos-1", nazev: "Upnutí 1" });
    const activity = routingSheet.addActivity(operation.id, position.id, {
      id: "act-1",
      operationTypeId: operationType.id,
      calculationType: "podelneVnejsi",
      toolId: tool.id,
    });

    await new SaveRoutingSheetDraftUseCase(ctx, routingSheetRepo, fas).execute({ routingSheet });

    // 5) Kalkulace (existující engine, jen přes doménový port) - vstupy odpovídají
    //    výše zaznamenaným řezným podmínkám (Vc/feed/ap).
    const calculateUseCase = new CalculateOperationUseCase(
      tenantContext(),
      machineRepo,
      toolRepo,
      operationTypeRepo,
      new LegacyCalculationEngine(),
      fas
    );
    const calculation = await calculateUseCase.execute({
      routingSheet,
      operationId: operation.id,
      positionId: position.id,
      activityId: activity.id,
      calculationType: "podelneVnejsi",
      inputParameters: [{ kontura: "K1", Dc: 40, Df: 20, L: 100, fHrub: 0.3, fDok: 0.1, VcHrub: 200, VcDok: 220, ap: 2 }],
    });

    expect(calculation.snapshot.machineId).toBe(machine.id);
    expect(calculation.snapshot.machineHourlyRate?.amount).toBe(1000);
    expect(calculation.snapshot.toolId).toBe(tool.id);
    expect(calculation.snapshot.operationTypeId).toBe(operationType.id);
    expect(calculation.result.total).toBeGreaterThan(0);

    await new SaveRoutingSheetDraftUseCase(ctx, routingSheetRepo, fas).execute({ routingSheet });

    // 6) Změna sazby stroje PO výpočtu (kmenová data se dál mění nezávisle) -
    //    zamrzlý snapshot starší kalkulace se NESMÍ změnit (docs/adr/0006).
    await new UpdateMachineUseCase(ctx, machineRepo, fas).execute(machine.id, { hourlyRate: HourlyRate.of(1500, "CZK") });
    const updatedMachine = await machineRepo.findById(machine.id, TENANT_ID);
    expect(updatedMachine?.hourlyRate.amount).toBe(1500);

    const reloaded = await routingSheetRepo.findById(routingSheet.id, TENANT_ID);
    const reloadedCalculation = reloaded?.getOperation(operation.id).getPosition(position.id).getActivity(activity.id).calculation;
    expect(reloadedCalculation?.snapshot.machineHourlyRate?.amount).toBe(1000);
    expect(reloadedCalculation?.snapshot.machineId).toBe(machine.id);
  });
});
