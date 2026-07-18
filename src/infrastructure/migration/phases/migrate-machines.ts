import { Machine } from "@/domain/entities/machine";
import { MachineCapability } from "@/domain/entities/machine-capability";
import { HourlyRate } from "@/domain/value-objects/hourly-rate";
import { IndexedDbMachineRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-machine-repository";
import { IndexedDbMachineCapabilityRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-machine-capability-repository";
import { LegacySourceData } from "../legacy-source";
import { MigrationContext } from "../context";
import { deterministicId } from "../id-mapping";
import { UNKNOWN_OPERATION_TYPE_ID } from "./seed-reference-data";

const LEGACY_SOURCE = "machines";

/** machines -> Machine (1:1) + MachineCapability (z Machine.operace: string[]).
 *  Legacy data neukládají měnu -> výchozí CZK (zadání, bod 4 - zdokumentováno
 *  jako "info" issue, ne tiché rozhodnutí). Neznámý opId v Machine.operace
 *  dostane bezpečný fallback OperationType v kategorii "other" (zadání, bod 4 -
 *  "buď vytvoř bezpečný OperationType v kategorii other") - capabilita se
 *  pořád vytvoří, jen s warningem v reportu, nic se nezahazuje. */
export async function runMigrateMachinesPhase(
  data: LegacySourceData,
  repos: { machines: IndexedDbMachineRepository; capabilities: IndexedDbMachineCapabilityRepository },
  context: MigrationContext
): Promise<void> {
  let usedDefaultCurrency = false;

  for (const machine of data.machines) {
    const newId = deterministicId("machine", machine.id);
    usedDefaultCurrency = true;
    const domainMachine = Machine.create({
      id: newId,
      nazev: machine.nazev,
      hourlyRate: HourlyRate.of(machine.sazba, "CZK"),
      stav: "aktivni",
    });
    await repos.machines.saveWithLegacyStamp(domainMachine, {
      legacySource: LEGACY_SOURCE,
      legacyId: machine.id,
      migrationRunId: context.migrationRunId,
    });
    context.machineIdMap.set(machine.id, newId);
    context.incrementCounter("created", "machines");

    let capabilityIndex = 0;
    for (const opId of machine.operace) {
      const operationTypeId = context.opIdToOperationTypeId.get(opId);
      if (!operationTypeId) {
        context.addIssue({
          severity: "warning",
          phase: "migrate-machines",
          code: "capability-unknown-op-id-fallback",
          message: `Stroj "${machine.id}": neznámý opId "${opId}" v seznamu podporovaných operací - capabilita vznikla s fallback klasifikací.`,
          legacySource: LEGACY_SOURCE,
          legacyId: machine.id,
        });
      }
      const capability = MachineCapability.create({
        id: deterministicId("machine-capability", `${machine.id}:${capabilityIndex}`),
        machineId: newId,
        operationTypeId: operationTypeId ?? UNKNOWN_OPERATION_TYPE_ID,
        enabled: true,
      });
      await repos.capabilities.saveWithLegacyStamp(capability, {
        legacySource: LEGACY_SOURCE,
        legacyId: `${machine.id}:${capabilityIndex}`,
        migrationRunId: context.migrationRunId,
      });
      context.incrementCounter("created", "machineCapabilities");
      capabilityIndex++;
    }
  }

  if (usedDefaultCurrency) {
    context.addIssue({
      severity: "info",
      phase: "migrate-machines",
      code: "default-currency-czk",
      message: 'Legacy data neukládají měnu hodinové sazby stroje - použita výchozí měna projektu "CZK".',
    });
  }
}
