import { Tool } from "@/domain/entities/tool";
import { ToolMachineCondition } from "@/domain/entities/tool-machine-condition";
import { CuttingParameters } from "@/domain/value-objects/cutting-parameters";
import { IndexedDbToolRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-tool-repository";
import { IndexedDbToolMachineConditionRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-tool-machine-condition-repository";
import { LegacySourceData } from "../legacy-source";
import { MigrationContext } from "../context";
import { deterministicId } from "../id-mapping";
import { TOOL_TYPE_FALLBACK_ID } from "./seed-reference-data";

const LEGACY_SOURCE = "toolRows";
const PREPARATION_OP_ID = "pripravneCasy";

function numberOrUndefined(value: string | number | null | undefined): number | undefined {
  return typeof value === "number" ? value : undefined;
}

/**
 * toolRows -> Tool + ToolMachineCondition (zadání, bod 4 - "Tool a
 * ToolMachineCondition"). Skutečný tvar (viz audit): jeden `toolRows` záznam je
 * (stroj, opId) pár s POLEM řádků uvnitř, ne jeden záznam = jeden nástroj -
 * a řádky nemají vlastní id.
 *
 * Identita: legacy data neobsahují nic stabilnějšího než pozici v poli, takže se
 * použije `${strojId}:${opId}:${index}` (3. úroveň z preferovaného pořadí
 * identity v zadání - žádné legacy tool id ani spolehlivá kombinace polí k
 * dispozici). Bez deduplikace mezi stroji - "Duplicita je méně nebezpečná než
 * chybné sloučení dvou různých nástrojů" (zadání, bod 31). Řádky pro
 * `pripravneCasy` jsou "šablony přípravných časů" (jen název + čas), ne nástroje
 * - vynechávají se z Tool/ToolMachineCondition, ale zůstávají zachyceny v
 * migračním reportu jako "info", nic se neztrácí (partOperationRows pro
 * pripravneCasy se migrují normálně jako Activity, nezávisle na téhle fázi).
 */
export async function runMigrateToolsPhase(
  data: LegacySourceData,
  repos: { tools: IndexedDbToolRepository; conditions: IndexedDbToolMachineConditionRepository },
  context: MigrationContext
): Promise<void> {
  let skippedPreparationTemplates = 0;

  for (const toolRow of data.toolRows) {
    if (toolRow.opId === PREPARATION_OP_ID) {
      skippedPreparationTemplates += toolRow.rows.length;
      continue;
    }

    const newMachineId = context.machineIdMap.get(toolRow.strojId);
    if (!newMachineId) {
      context.addIssue({
        severity: "warning",
        phase: "migrate-tools",
        code: "tool-rows-skipped-missing-machine",
        message: `Katalog nástrojů "${toolRow.id}" přeskočen - stroj "${toolRow.strojId}" nebyl migrován.`,
        legacySource: LEGACY_SOURCE,
        legacyId: toolRow.id,
      });
      context.incrementCounter("skipped", "tools", toolRow.rows.length);
      continue;
    }

    const operationTypeId = context.opIdToOperationTypeId.get(toolRow.opId);

    for (let index = 0; index < toolRow.rows.length; index++) {
      const row = toolRow.rows[index];
      const legacyRowId = `${toolRow.strojId}:${toolRow.opId}:${index}`;
      const toolId = deterministicId("tool", legacyRowId);
      const nazev = typeof row.nazev === "string" && row.nazev.trim() ? row.nazev.trim() : `Nástroj ${index + 1}`;
      const parameters = CuttingParameters.of({
        vc: numberOrUndefined(row.VcHrub ?? row.Vc ?? row.VcZap),
        feed: numberOrUndefined(row.fHrub ?? row.f ?? row.Fax ?? row.fZap),
        ap: numberOrUndefined(row.ap),
      });

      const tool = Tool.create({
        id: toolId,
        nazev,
        toolTypeId: TOOL_TYPE_FALLBACK_ID,
        stav: "aktivni",
        defaultCuttingParameters: parameters,
      });

      const condition = ToolMachineCondition.create({
        id: deterministicId("tool-machine-condition", legacyRowId),
        toolId,
        machineId: newMachineId,
        parameters,
        stav: "aktivni",
        operationTypeId,
      });

      await repos.tools.saveWithLegacyStamp(tool, {
        legacySource: LEGACY_SOURCE,
        legacyId: legacyRowId,
        migrationRunId: context.migrationRunId,
      });
      await repos.conditions.saveWithLegacyStamp(condition, {
        legacySource: LEGACY_SOURCE,
        legacyId: legacyRowId,
        migrationRunId: context.migrationRunId,
      });
      context.incrementCounter("created", "tools");
      context.incrementCounter("created", "toolMachineConditions");
    }
  }

  if (skippedPreparationTemplates > 0) {
    context.addIssue({
      severity: "info",
      phase: "migrate-tools",
      code: "preparation-templates-not-migrated-as-tools",
      message:
        `${skippedPreparationTemplates} řádků "šablon přípravných časů" (opId="${PREPARATION_OP_ID}") ` +
        "nebylo migrováno jako Tool - nejsou to fyzické nástroje. Odpovídající vstupní data v Activity zůstávají zachována.",
    });
    context.incrementCounter("skipped", "toolTemplates", skippedPreparationTemplates);
  }
}
