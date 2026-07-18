import { IssueSeverity, MigrationCounters, emptyMigrationCounters } from "@/infrastructure/persistence/indexeddb/records";

export interface MigrationIssue {
  severity: IssueSeverity;
  phase: string;
  code: string;
  message: string;
  legacySource?: string;
  legacyId?: string;
}

/**
 * Sdílený stav jednoho migračního běhu - předává se mezi fázemi (zadání, bod 12).
 * Mapy legacyId -> newId jsou předpočítané kvůli výkonu (zadání, bod 21) - žádné
 * opakované hledání ve store při zpracování každého řádku.
 */
export class MigrationContext {
  readonly counters: MigrationCounters = emptyMigrationCounters();
  readonly issues: MigrationIssue[] = [];

  readonly customerIdMap = new Map<string, string>(); // legacyCustomerId -> newCustomerId
  readonly orderIdMap = new Map<string, string>(); // legacyInquiryId -> newOrderId
  readonly partIdMap = new Map<string, string>(); // legacyPartId -> newPartId
  readonly routingSheetIdMap = new Map<string, string>(); // legacyPartId -> newRoutingSheetId
  readonly operationIdByLegacyPositionId = new Map<string, string>(); // legacyPositionId -> newOperationId
  readonly positionIdByLegacyPositionId = new Map<string, string>(); // legacyPositionId -> newPositionId
  readonly machineIdMap = new Map<string, string>(); // legacyMachineId -> newMachineId
  readonly opIdToOperationTypeId = new Map<string, string>();

  constructor(
    readonly migrationRunId: string,
    readonly toolTypeFallbackId: string
  ) {}

  addIssue(issue: MigrationIssue): void {
    this.issues.push(issue);
  }

  incrementCounter(kind: keyof MigrationCounters, key: string, by = 1): void {
    const bucket = this.counters[kind] as Record<string, number>;
    bucket[key] = (bucket[key] ?? 0) + by;
  }

  hasFatal(): boolean {
    return this.issues.some((i) => i.severity === "fatal");
  }

  hasWarningsOrErrors(): boolean {
    return this.issues.some((i) => i.severity === "warning" || i.severity === "error");
  }
}
