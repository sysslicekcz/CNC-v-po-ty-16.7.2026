import { OperationTypeRepository } from "@/domain/repositories/operation-type-repository";
import { ToolTypeRepository } from "@/domain/repositories/tool-type-repository";
import { OperationType } from "@/domain/entities/operation-type";
import { ToolType } from "@/domain/entities/tool-type";
import { MigrationContext } from "../context";
import { buildOperationTypeSeed, buildOpIdToOperationTypeIdMap } from "../operation-type-seed";
import { deterministicId } from "../id-mapping";

export const TOOL_TYPE_FALLBACK_ID = deterministicId("tool-type", "obecny");
/** Catch-all pro legacy opId, které neodpovídá žádnému známému typu operace
 *  (starší/cizí data) - kategorie "other" se nekontroluje jako speciální
 *  případ, ale zůstává mimo capability matching díky kategorii "other" (ne
 *  "preparation" - ta má jiný, specifický význam). */
export const UNKNOWN_OPERATION_TYPE_ID = deterministicId("operation-type", "unknown-legacy");

/**
 * Seeduje číselník OperationType (deterministická id, viz operation-type-seed.ts)
 * a jeden obecný fallback ToolType - legacy `toolRows` nerozlišují typ nástroje
 * vůbec (jen název + řezné parametry), takže bez tohohle fallbacku by nešlo
 * splnit povinné pole Tool.toolTypeId. Zdokumentováno jako "info" issue, ne
 * tiché rozhodnutí (zadání, bod 31).
 */
export async function runSeedReferenceDataPhase(
  operationTypeRepository: OperationTypeRepository,
  toolTypeRepository: ToolTypeRepository,
  context: MigrationContext
): Promise<void> {
  const operationTypes = buildOperationTypeSeed();
  for (const operationType of operationTypes) {
    await operationTypeRepository.save(operationType);
    context.incrementCounter("created", "operationTypes");
  }
  for (const [opId, operationTypeId] of buildOpIdToOperationTypeIdMap()) {
    context.opIdToOperationTypeId.set(opId, operationTypeId);
  }

  const unknownOperationType = OperationType.create({
    id: UNKNOWN_OPERATION_TYPE_ID,
    kod: "unknown-legacy",
    nazev: "Neznámý legacy typ operace",
    kategorie: "other",
    stav: "aktivni",
    popis: "Fallback pro legacy opId, který neodpovídá žádnému známému typu operace v aktuálním operations.ts.",
  });
  await operationTypeRepository.save(unknownOperationType);
  context.incrementCounter("created", "operationTypes");

  const fallbackToolType = ToolType.create({
    id: TOOL_TYPE_FALLBACK_ID,
    kod: "obecny",
    nazev: "Obecný nástroj (typ nerozlišen v legacy datech)",
    stav: "aktivni",
  });
  await toolTypeRepository.save(fallbackToolType);
  context.incrementCounter("created", "toolTypes");
  context.addIssue({
    severity: "info",
    phase: "seed-reference-data",
    code: "tool-type-fallback",
    message:
      "Legacy katalog nástrojů (toolRows) nerozlišuje typ nástroje - všechny migrované Tool záznamy dostaly " +
      `obecný fallback ToolType ("${TOOL_TYPE_FALLBACK_ID}").`,
  });
}
