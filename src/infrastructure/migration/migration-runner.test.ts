import { describe, it, expect, beforeEach } from "vitest";
import { runMigrationEngine } from "./migration-runner";
import { rollbackMigrationRun } from "./rollback";
import { LegacySourceData } from "./legacy-source";
import { deleteTpvDbForTests, tpvGetAll } from "@/infrastructure/persistence/indexeddb/tpv-db";
import { IndexedDbRoutingSheetRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-routing-sheet-repository";
import { CustomerRecord, OrderRecord, PartRecord, MachineCapabilityRecord, ToolRecord } from "@/infrastructure/persistence/indexeddb/records";

function emptyLegacyData(): LegacySourceData {
  return { customers: [], inquiries: [], parts: [], positions: [], partOperationRows: [], toolRows: [], machines: [] };
}

function onePartScenario(): LegacySourceData {
  return {
    customers: [{ id: "cust-1", nazev: "ACME", createdAt: 1000 }],
    inquiries: [{ id: "inq-1", customerId: "cust-1", nazev: "Zakázka 1", createdAt: 1000 }],
    parts: [{ id: "part-1", inquiryId: "inq-1", cisloVykresu: "V-1", nazev: "Hřídel", createdAt: 1000 }],
    positions: [{ id: "pos-1", partId: "part-1", nazev: "Upnutí", createdAt: 1000, strojId: "machine-1" }],
    partOperationRows: [
      { id: "pos-1:podelneVnejsi", partId: "pos-1", opId: "podelneVnejsi", rows: [{ kontura: "K1", Dc: 40, Df: 20, L: 100 }] },
      { id: "pos-1:vrtani", partId: "pos-1", opId: "vrtani", rows: [{ kontura: "K1", pocetDer: 2, D: 10, L: 20 }] },
    ],
    toolRows: [
      {
        id: "machine-1:podelneVnejsi",
        strojId: "machine-1",
        opId: "podelneVnejsi",
        rows: [{ nazev: "Nůž 1", VcHrub: 180, fHrub: 0.3, ap: 2 }],
      },
    ],
    machines: [{ id: "machine-1", nazev: "PUMA 700", sazba: 1200, operace: ["podelneVnejsi", "vrtani"], createdAt: 1000 }],
  };
}

describe("runMigrationEngine", () => {
  beforeEach(async () => {
    await deleteTpvDbForTests();
  });

  it("prázdná databáze - migrace se dokončí bez chyb, nulové počty", async () => {
    const report = await runMigrationEngine({ legacyData: emptyLegacyData() });
    expect(report.status).toBe("completed");
    expect(report.sourceCounts.customers).toBe(0);
    expect(report.created.customers ?? 0).toBe(0);
    expect(report.errors).toHaveLength(0);
  });

  it("jeden kompletní díl - vytvoří celý strom podle mapování", async () => {
    const report = await runMigrationEngine({ legacyData: onePartScenario() });
    expect(["completed", "completed_with_warnings"]).toContain(report.status);
    expect(report.created.customers).toBe(1);
    expect(report.created.orders).toBe(1);
    expect(report.created.parts).toBe(1);
    expect(report.created.routingSheets).toBe(1);
    expect(report.created.operations).toBe(1);
    expect(report.created.positions).toBe(1);
    expect(report.created.activities).toBe(2);

    const customers = await tpvGetAll<CustomerRecord>("tpvCustomers");
    expect(customers).toHaveLength(1);
    expect(customers[0].legacyId).toBe("cust-1");

    const routingSheetRepo = new IndexedDbRoutingSheetRepository();
    const parts = await tpvGetAll<PartRecord>("tpvParts");
    const routingSheets = await routingSheetRepo.findByPartId(parts[0].id);
    expect(routingSheets).toHaveLength(1);
    expect(routingSheets[0].isDefault).toBe(true);
    expect(routingSheets[0].operationList).toHaveLength(1);
    expect(routingSheets[0].operationList[0].positionList[0].activityList).toHaveLength(2);
    // Žádná Calculation - legacy appka výsledek nikdy neukládala.
    expect(routingSheets[0].operationList[0].positionList[0].activityList[0].calculation).toBeUndefined();
  });

  it("více pozic jednoho dílu - každá vlastní Operation + Position, žádné sloučení podle opId", async () => {
    const data = onePartScenario();
    data.positions.push({ id: "pos-2", partId: "part-1", nazev: "Upnutí 2", createdAt: 2000, strojId: "machine-1" });
    data.partOperationRows.push({
      id: "pos-2:podelneVnejsi",
      partId: "pos-2",
      opId: "podelneVnejsi",
      rows: [{ kontura: "K2", Dc: 30, Df: 15, L: 50 }],
    });

    await runMigrationEngine({ legacyData: data });

    const routingSheetRepo = new IndexedDbRoutingSheetRepository();
    const parts = await tpvGetAll<PartRecord>("tpvParts");
    const [routingSheet] = await routingSheetRepo.findByPartId(parts[0].id);
    expect(routingSheet.operationList).toHaveLength(2);
    expect(routingSheet.operationList[0].positionList).toHaveLength(1);
    expect(routingSheet.operationList[1].positionList).toHaveLength(1);
  });

  it("stejný opId na dvou různých strojích vytvoří dvě Activity v různých větvích stromu", async () => {
    const data = onePartScenario();
    data.machines.push({ id: "machine-2", nazev: "DMU 50", sazba: 1500, operace: ["podelneVnejsi"], createdAt: 1000 });
    data.positions.push({ id: "pos-2", partId: "part-1", nazev: "Upnutí 2", createdAt: 2000, strojId: "machine-2" });
    data.partOperationRows.push({
      id: "pos-2:podelneVnejsi",
      partId: "pos-2",
      opId: "podelneVnejsi",
      rows: [{ kontura: "K2", Dc: 30, Df: 15, L: 50 }],
    });

    await runMigrationEngine({ legacyData: data });

    const routingSheetRepo = new IndexedDbRoutingSheetRepository();
    const parts = await tpvGetAll<PartRecord>("tpvParts");
    const [routingSheet] = await routingSheetRepo.findByPartId(parts[0].id);
    const machineIds = routingSheet.operationList.map((o) => o.machineId);
    expect(new Set(machineIds).size).toBe(2);
    const activitiesWithSameCalcType = routingSheet.operationList
      .flatMap((o) => o.positionList)
      .flatMap((p) => p.activityList)
      .filter((a) => a.calculationType === "podelneVnejsi");
    expect(activitiesWithSameCalcType).toHaveLength(2);
  });

  it("neznámý opId - nic se neztratí, vznikne warning a fallback OperationType", async () => {
    const data = onePartScenario();
    data.partOperationRows.push({
      id: "pos-1:tajemna-operace",
      partId: "pos-1",
      opId: "tajemna-operace",
      rows: [{ kontura: "K9", hodnota: 1 }],
    });

    const report = await runMigrationEngine({ legacyData: data });
    expect(report.created.activities).toBe(3);
    expect(report.warnings.some((w) => w.code === "unknown-op-id" || w.code === "activity-unknown-op-id-fallback")).toBe(
      true
    );
  });

  it("chybějící Machine - Operation vznikne bez machineId, data Activity se nezruší", async () => {
    const data = onePartScenario();
    data.positions[0].strojId = "neexistujici-stroj";

    const report = await runMigrationEngine({ legacyData: data });
    expect(report.created.activities).toBe(2);

    const routingSheetRepo = new IndexedDbRoutingSheetRepository();
    const parts = await tpvGetAll<PartRecord>("tpvParts");
    const [routingSheet] = await routingSheetRepo.findByPartId(parts[0].id);
    expect(routingSheet.operationList[0].machineId).toBeUndefined();
    expect(routingSheet.operationList[0].positionList[0].activityList).toHaveLength(2);
  });

  it("neúplný Tool (bez strojId) - Activity vznikne i bez toolId, vstupní data zůstanou", async () => {
    const data = onePartScenario();
    data.toolRows[0].strojId = "";

    const report = await runMigrationEngine({ legacyData: data });
    expect(report.created.activities).toBe(2);
    const tools = await tpvGetAll<ToolRecord>("tpvTools");
    expect(tools).toHaveLength(0); // katalog bez platného stroje se nemigroval, ale Activity ano
  });

  it("opakované spuštění nevytvoří duplicity", async () => {
    const data = onePartScenario();
    await runMigrationEngine({ legacyData: data });
    const report2 = await runMigrationEngine({ legacyData: data });

    expect(report2.status).not.toBe("failed");
    const customers = await tpvGetAll<CustomerRecord>("tpvCustomers");
    const orders = await tpvGetAll<OrderRecord>("tpvOrders");
    const capabilities = await tpvGetAll<MachineCapabilityRecord>("tpvMachineCapabilities");
    expect(customers).toHaveLength(1);
    expect(orders).toHaveLength(1);
    expect(capabilities).toHaveLength(2); // 2 položky v machine.operace, ne zdvojnásobené
  });

  it("rollback odstraní jen nová data daného běhu, staré stores (legacy zdroj) zůstávají mimo dosah", async () => {
    const report = await runMigrationEngine({ legacyData: onePartScenario() });
    await rollbackMigrationRun(report.migrationRunId);

    const customers = await tpvGetAll<CustomerRecord>("tpvCustomers");
    const parts = await tpvGetAll<PartRecord>("tpvParts");
    expect(customers).toHaveLength(0);
    expect(parts).toHaveLength(0);
  });

  it("druhé spuštění po rollbacku znovu vytvoří data (bez zbytků po rollbacku)", async () => {
    const first = await runMigrationEngine({ legacyData: onePartScenario() });
    await rollbackMigrationRun(first.migrationRunId);

    const second = await runMigrationEngine({ legacyData: onePartScenario() });
    expect(second.created.customers).toBe(1);
    const customers = await tpvGetAll<CustomerRecord>("tpvCustomers");
    expect(customers).toHaveLength(1);
  });
});
