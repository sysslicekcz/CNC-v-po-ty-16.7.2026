import { RoutingSheet } from "@/domain/aggregates/routing-sheet/routing-sheet";
import { Machine } from "@/domain/entities/machine";
import { ExternalOperationResource } from "@/domain/entities/external-operation-resource";
import { OperationType } from "@/domain/entities/operation-type";
import { RoutingValidationIssueDto } from "./dto/routing-validation-issue-dto";

export interface ValidateRoutingSheetInput {
  routingSheet: RoutingSheet;
  machinesById: Map<string, Machine>;
  externalResourcesById: Map<string, ExternalOperationResource>;
  operationTypesById: Map<string, OperationType>;
}

/**
 * Čistá (synchronní) doménová validace nad už načteným agregátem a číselníky
 * (Krok 4, zadání bod 25/26) - vždy vrací VŠECHNY nálezy najednou, bez ohledu
 * na to, jestli se používají jen k informativnímu zobrazení v draftu, nebo k
 * blokování release. Rozlišení dělá volající:
 *  - draft UI zobrazí všechny závažnosti jako indikátory, nic neblokuje,
 *  - `ReleaseRoutingSheetUseCase` odmítne release, pokud je mezi nálezy
 *    aspoň jeden se `severity === "error"`.
 *
 * Validace NENÍ implementovaná v React komponentách (zadání bod 26 - "Doménová
 * validace nesmí být implementována pouze v React komponentách") - tahle třída
 * je jediné místo, které pravidla zná.
 */
export class ValidateRoutingSheetUseCase {
  execute(input: ValidateRoutingSheetInput): RoutingValidationIssueDto[] {
    const { routingSheet, machinesById, externalResourcesById, operationTypesById } = input;
    const issues: RoutingValidationIssueDto[] = [];
    let issueSeq = 0;
    const nextId = () => `validation:${routingSheet.id}:${issueSeq++}`;

    const operations = routingSheet.operationList;

    if (operations.length === 0) {
      issues.push({
        id: nextId(),
        severity: "error",
        code: "routing-sheet-empty",
        message: "Technologický postup neobsahuje žádnou operaci.",
        routingSheetId: routingSheet.id,
      });
      return issues;
    }

    const seenOperationNumbers = new Set<number>();
    for (const operation of operations) {
      if (seenOperationNumbers.has(operation.operationNumber.value)) {
        issues.push({
          id: nextId(),
          severity: "error",
          code: "operations-ambiguous-order",
          message: "Pořadí operací není jednoznačné - dvě operace mají stejné číslo.",
          routingSheetId: routingSheet.id,
          operationId: operation.id,
        });
      }
      seenOperationNumbers.add(operation.operationNumber.value);

      const assignment = operation.resourceAssignment;
      if (assignment.type === "unassigned") {
        issues.push({
          id: nextId(),
          severity: "error",
          code: "operation-missing-resource",
          message: `Operace ${operation.operationNumber.value} nemá přiřazený zdroj.`,
          routingSheetId: routingSheet.id,
          operationId: operation.id,
          field: "resourceAssignment",
        });
      } else if (assignment.type === "machine") {
        const machine = machinesById.get(assignment.machineId);
        if (!machine) {
          issues.push({
            id: nextId(),
            severity: "error",
            code: "operation-unknown-machine",
            message: `Operace ${operation.operationNumber.value} odkazuje na neexistující stroj.`,
            routingSheetId: routingSheet.id,
            operationId: operation.id,
            field: "machineId",
          });
        } else if (machine.status !== "active") {
          issues.push({
            id: nextId(),
            severity: "warning",
            code: "operation-inactive-machine",
            message: `Operace ${operation.operationNumber.value} používá neaktivní stroj.`,
            routingSheetId: routingSheet.id,
            operationId: operation.id,
            field: "machineId",
          });
        }
      } else if (assignment.type === "external") {
        const resource = externalResourcesById.get(assignment.externalResourceId);
        if (!resource) {
          issues.push({
            id: nextId(),
            severity: "error",
            code: "operation-unknown-external-resource",
            message: `Operace ${operation.operationNumber.value} odkazuje na neexistující kooperaci.`,
            routingSheetId: routingSheet.id,
            operationId: operation.id,
            field: "externalResourceId",
          });
        } else if (resource.status !== "active") {
          issues.push({
            id: nextId(),
            severity: "warning",
            code: "operation-inactive-external-resource",
            message: `Operace ${operation.operationNumber.value} používá neaktivní kooperaci.`,
            routingSheetId: routingSheet.id,
            operationId: operation.id,
            field: "externalResourceId",
          });
        }
      }

      const hasExplicitTime = operation.setupTimeMinutes !== undefined || operation.unitTimeMinutes !== undefined;
      if (assignment.type !== "unassigned" && !hasExplicitTime && operation.finalTime === 0) {
        issues.push({
          id: nextId(),
          severity: "warning",
          code: "operation-missing-time",
          message: `Operace ${operation.operationNumber.value} nemá kusový čas.`,
          routingSheetId: routingSheet.id,
          operationId: operation.id,
          field: "unitTimeMinutes",
        });
      }

      const seenPositionKeys = new Set<string>();
      for (const position of operation.positionList) {
        const posKey = position.sortKey?.toString() ?? position.id;
        if (position.sortKey && seenPositionKeys.has(posKey)) {
          issues.push({
            id: nextId(),
            severity: "error",
            code: "positions-ambiguous-order",
            message: `Upnutí operace ${operation.operationNumber.value} nemají jednoznačné pořadí.`,
            routingSheetId: routingSheet.id,
            operationId: operation.id,
            positionId: position.id,
          });
        }
        seenPositionKeys.add(posKey);

        for (const activity of position.activityList) {
          const operationType = operationTypesById.get(activity.operationTypeId);
          if (!operationType) {
            issues.push({
              id: nextId(),
              severity: "error",
              code: "activity-unknown-operation-type",
              message: `Činnost v upnutí "${position.nazev}" (operace ${operation.operationNumber.value}) odkazuje na neznámý typ operace.`,
              routingSheetId: routingSheet.id,
              operationId: operation.id,
              positionId: position.id,
              activityId: activity.id,
              field: "operationTypeId",
            });
          }
        }
      }
    }

    return issues;
  }
}
