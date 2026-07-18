import { CustomerRepository } from "@/domain/repositories/customer-repository";
import { OrderRepository } from "@/domain/repositories/order-repository";
import { PartRepository } from "@/domain/repositories/part-repository";
import { MachineRepository } from "@/domain/repositories/machine-repository";
import { IndexedDbRoutingSheetRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-routing-sheet-repository";
import { tpvGet } from "@/infrastructure/persistence/indexeddb/tpv-db";
import { ActivityRecord } from "@/infrastructure/persistence/indexeddb/records";
import { LegacySourceData } from "../legacy-source";
import { MigrationContext } from "../context";
import { ValidationCheckResult } from "../types";
import { deterministicId } from "../id-mapping";
import { deepEqual } from "../deep-equal";

/**
 * Ověří výsledek migrace proti skutečným legacy datům (zadání, bod 16) - čte
 * z reálných repozitářů/records, nespoléhá se jen na dopočítané countery.
 * Nepoužívá JSON string porovnání pro vstupní data (deepEqual místo toho).
 */
export async function runPostValidationPhase(
  data: LegacySourceData,
  repos: {
    customers: CustomerRepository;
    orders: OrderRepository;
    parts: PartRepository;
    machines: MachineRepository;
    routingSheets: IndexedDbRoutingSheetRepository;
  },
  context: MigrationContext
): Promise<ValidationCheckResult[]> {
  const checks: ValidationCheckResult[] = [];
  const skippedOrders = context.counters.skipped.orders ?? 0;
  const skippedParts = context.counters.skipped.parts ?? 0;

  checks.push({
    name: "customers-count",
    passed: context.customerIdMap.size === data.customers.length,
    detail: `legacy=${data.customers.length}, migrováno=${context.customerIdMap.size}`,
  });

  checks.push({
    name: "orders-count-reconciles",
    passed: context.orderIdMap.size + skippedOrders === data.inquiries.length,
    detail: `legacy=${data.inquiries.length}, migrováno=${context.orderIdMap.size}, přeskočeno=${skippedOrders}`,
  });

  checks.push({
    name: "parts-count-reconciles",
    passed: context.partIdMap.size + skippedParts === data.parts.length,
    detail: `legacy=${data.parts.length}, migrováno=${context.partIdMap.size}, přeskočeno=${skippedParts}`,
  });

  // Invariant "1 stará Position -> 1 nová Operation + 1 nová Position" (zadání,
  // bod 4) - obě mapy musí mít vždy stejnou velikost, bez ohledu na to, kolik
  // dílů/pozic bylo přeskočeno kvůli chybějícím rodičům výše ve stromu.
  checks.push({
    name: "operations-equals-positions",
    passed: context.operationIdByLegacyPositionId.size === context.positionIdByLegacyPositionId.size,
    detail: `operations=${context.operationIdByLegacyPositionId.size}, positions=${context.positionIdByLegacyPositionId.size}`,
  });

  // Vazby: Order -> Customer, Part -> Order
  let ordersWithCustomer = 0;
  for (const newOrderId of context.orderIdMap.values()) {
    const order = await repos.orders.findById(newOrderId);
    if (order && (await repos.customers.findById(order.customerId))) ordersWithCustomer++;
  }
  checks.push({
    name: "every-order-has-customer",
    passed: ordersWithCustomer === context.orderIdMap.size,
    detail: `${ordersWithCustomer}/${context.orderIdMap.size}`,
  });

  let partsWithOrder = 0;
  for (const newPartId of context.partIdMap.values()) {
    const part = await repos.parts.findById(newPartId);
    if (part && (await repos.orders.findById(part.orderId))) partsWithOrder++;
  }
  checks.push({
    name: "every-part-has-order",
    passed: partsWithOrder === context.partIdMap.size,
    detail: `${partsWithOrder}/${context.partIdMap.size}`,
  });

  // Výchozí postup: každý migrovaný Part má právě jeden isDefault RoutingSheet.
  let defaultRoutingSheetOk = 0;
  for (const [legacyPartId, newPartId] of context.partIdMap) {
    const routingSheets = await repos.routingSheets.findByPartId(newPartId);
    const defaults = routingSheets.filter((rs) => rs.isDefault);
    if (defaults.length === 1) {
      defaultRoutingSheetOk++;
    } else {
      context.addIssue({
        severity: "error",
        phase: "post-validation",
        code: "default-routing-sheet-count-mismatch",
        message: `Díl (legacy "${legacyPartId}") má ${defaults.length} výchozích RoutingSheet místo přesně jednoho.`,
        legacySource: "parts",
        legacyId: legacyPartId,
      });
    }
  }
  checks.push({
    name: "exactly-one-default-routing-sheet-per-part",
    passed: defaultRoutingSheetOk === context.partIdMap.size,
    detail: `${defaultRoutingSheetOk}/${context.partIdMap.size}`,
  });

  // Výpočtová data: pro každý partOperationRows existuje Activity, calculationType
  // odpovídá opId, vstupní rows jsou strukturálně (ne řetězcově) shodné.
  const legacyPositionToLegacyPartId = new Map(data.positions.map((p) => [p.id, p.partId]));
  let rowsChecked = 0;
  let rowsOk = 0;
  for (const row of data.partOperationRows) {
    const legacyPartId = legacyPositionToLegacyPartId.get(row.partId);
    if (!legacyPartId || !context.routingSheetIdMap.has(legacyPartId)) continue; // osiřelý řádek / přeskočený díl - už nahlášeno jinde
    rowsChecked++;
    const activityId = deterministicId("activity", row.id);
    const activityRecord = await tpvGet<ActivityRecord>("tpvActivities", activityId);
    if (!activityRecord) {
      context.addIssue({
        severity: "error",
        phase: "post-validation",
        code: "activity-missing",
        message: `Activity pro legacy operační řádky "${row.id}" nebyla nalezena.`,
        legacySource: "partOperationRows",
        legacyId: row.id,
      });
      continue;
    }
    const calculationTypeOk = activityRecord.calculationType === row.opId;
    const inputDataOk = deepEqual(activityRecord.legacyInputParameters ?? [], row.rows);
    if (calculationTypeOk && inputDataOk) {
      rowsOk++;
    } else {
      context.addIssue({
        severity: "error",
        phase: "post-validation",
        code: "activity-data-mismatch",
        message: `Activity "${activityId}" neodpovídá legacy řádkům "${row.id}" (calculationType shoda: ${calculationTypeOk}, vstupní data shoda: ${inputDataOk}).`,
        legacySource: "partOperationRows",
        legacyId: row.id,
      });
    }
  }
  checks.push({
    name: "activity-input-data-matches-legacy-rows",
    passed: rowsOk === rowsChecked,
    detail: `${rowsOk}/${rowsChecked} zkontrolovaných řádků odpovídá (celkem legacy řádků: ${data.partOperationRows.length})`,
  });

  // Stroje: počet a hodinové sazby.
  let machinesOk = 0;
  for (const machine of data.machines) {
    const newId = context.machineIdMap.get(machine.id);
    const migrated = newId ? await repos.machines.findById(newId) : null;
    if (migrated && migrated.hourlyRate.amount === machine.sazba) machinesOk++;
  }
  checks.push({
    name: "machines-count-and-hourly-rate-match",
    passed: machinesOk === data.machines.length,
    detail: `${machinesOk}/${data.machines.length}`,
  });

  return checks;
}
