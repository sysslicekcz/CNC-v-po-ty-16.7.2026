import { LegacySourceData } from "../legacy-source";
import { MigrationContext } from "../context";
import { OPERATIONS } from "@/lib/operations";

const KNOWN_OP_IDS = new Set(OPERATIONS.map((op) => op.id));

function findDuplicateIds(items: { id: string }[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) duplicates.add(item.id);
    seen.add(item.id);
  }
  return [...duplicates];
}

/**
 * Ověří skutečná data PŘED jakýmkoli zápisem (zadání, bod 13). `fatal` problém
 * migraci zastaví (nastaví MigrationRunRecord.status = "failed"), `warning` se
 * jen zapíše do reportu a migrace pokračuje - v duchu "Preferuj zachování dat
 * před jejich zahozením" (zadání, bod 31) jsou fatální jen situace, které by
 * samotné vytváření deterministických id/map učinily nespolehlivým (duplicitní
 * primární klíče); chybějící vazby (osiřelý Part/Position/řádek, neznámý
 * strojId/opId) jsou vždy jen warning - data se přesto migrují, jak nejlíp jde.
 */
export function runPreflightValidation(data: LegacySourceData, context: MigrationContext): void {
  context.incrementCounter("sourceCounts", "customers", data.customers.length);
  context.incrementCounter("sourceCounts", "inquiries", data.inquiries.length);
  context.incrementCounter("sourceCounts", "parts", data.parts.length);
  context.incrementCounter("sourceCounts", "positions", data.positions.length);
  context.incrementCounter("sourceCounts", "partOperationRows", data.partOperationRows.length);
  context.incrementCounter("sourceCounts", "toolRows", data.toolRows.length);
  context.incrementCounter("sourceCounts", "machines", data.machines.length);

  for (const [label, items] of [
    ["customers", data.customers],
    ["inquiries", data.inquiries],
    ["parts", data.parts],
    ["positions", data.positions],
    ["partOperationRows", data.partOperationRows],
    ["toolRows", data.toolRows],
    ["machines", data.machines],
  ] as const) {
    for (const dup of findDuplicateIds(items)) {
      context.addIssue({
        severity: "fatal",
        phase: "preflight",
        code: "duplicate-legacy-id",
        message: `Store "${label}" obsahuje duplicitní id "${dup}" - deterministická migrační id by kolidovala.`,
        legacySource: label,
        legacyId: dup,
      });
    }
  }

  const customerIds = new Set(data.customers.map((c) => c.id));
  const inquiryIds = new Set(data.inquiries.map((i) => i.id));
  const partIds = new Set(data.parts.map((p) => p.id));
  const positionIds = new Set(data.positions.map((p) => p.id));
  const machineIds = new Set(data.machines.map((m) => m.id));

  for (const inquiry of data.inquiries) {
    if (!customerIds.has(inquiry.customerId)) {
      context.addIssue({
        severity: "warning",
        phase: "preflight",
        code: "inquiry-missing-customer",
        message: `Poptávka/zakázka "${inquiry.id}" odkazuje na neexistujícího zákazníka "${inquiry.customerId}".`,
        legacySource: "inquiries",
        legacyId: inquiry.id,
      });
    }
  }

  for (const part of data.parts) {
    if (!inquiryIds.has(part.inquiryId)) {
      context.addIssue({
        severity: "warning",
        phase: "preflight",
        code: "part-missing-inquiry",
        message: `Díl "${part.id}" odkazuje na neexistující poptávku/zakázku "${part.inquiryId}".`,
        legacySource: "parts",
        legacyId: part.id,
      });
    }
  }

  for (const position of data.positions) {
    if (!partIds.has(position.partId)) {
      context.addIssue({
        severity: "warning",
        phase: "preflight",
        code: "position-missing-part",
        message: `Poloha "${position.id}" odkazuje na neexistující díl "${position.partId}".`,
        legacySource: "positions",
        legacyId: position.id,
      });
    }
    if (position.strojId && !machineIds.has(position.strojId)) {
      context.addIssue({
        severity: "warning",
        phase: "preflight",
        code: "position-missing-machine",
        message: `Poloha "${position.id}" odkazuje na neexistující stroj "${position.strojId}".`,
        legacySource: "positions",
        legacyId: position.id,
      });
    }
  }

  for (const row of data.partOperationRows) {
    // pole "partId" na tomhle záznamu je ve skutečnosti id polohy (viz audit) -
    // proto se ověřuje proti positionIds, ne proti partIds.
    if (!positionIds.has(row.partId)) {
      context.addIssue({
        severity: "warning",
        phase: "preflight",
        code: "operation-rows-missing-position",
        message: `Operační řádky "${row.id}" odkazují na neexistující polohu "${row.partId}".`,
        legacySource: "partOperationRows",
        legacyId: row.id,
      });
    }
    if (!KNOWN_OP_IDS.has(row.opId)) {
      context.addIssue({
        severity: "warning",
        phase: "preflight",
        code: "unknown-op-id",
        message: `Operační řádky "${row.id}" mají neznámý opId "${row.opId}" - použije se fallback OperationType "other".`,
        legacySource: "partOperationRows",
        legacyId: row.id,
      });
    }
  }

  for (const toolRow of data.toolRows) {
    if (toolRow.strojId && !machineIds.has(toolRow.strojId)) {
      context.addIssue({
        severity: "warning",
        phase: "preflight",
        code: "tool-rows-missing-machine",
        message: `Katalog nástrojů "${toolRow.id}" odkazuje na neexistující stroj "${toolRow.strojId}".`,
        legacySource: "toolRows",
        legacyId: toolRow.id,
      });
    }
  }

  for (const customer of data.customers) {
    if (!customer.nazev?.trim()) {
      context.addIssue({
        severity: "warning",
        phase: "preflight",
        code: "customer-missing-nazev",
        message: `Zákazník "${customer.id}" nemá vyplněný název - použije se placeholder.`,
        legacySource: "customers",
        legacyId: customer.id,
      });
    }
  }
}
