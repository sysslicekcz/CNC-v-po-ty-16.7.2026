"use client";

import { RoutingOperationEditorDto } from "@/application/routing-sheets/dto/routing-sheet-editor-dto";
import { RoutingValidationIssueDto } from "@/application/routing-sheets/dto/routing-validation-issue-dto";

function formatMinutes(value: number | undefined): string {
  if (value === undefined) return "-";
  return `${value.toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} min`;
}

function resourceLabel(operation: RoutingOperationEditorDto): string {
  if (operation.resourceType === "machine") return `${operation.machineCode ?? "?"} – ${operation.machineName ?? "?"}`;
  if (operation.resourceType === "external") return `${operation.externalResourceCode ?? "?"} – ${operation.externalResourceName ?? "?"}`;
  return "Bez přiřazeného zdroje";
}

export interface RoutingOperationListProps {
  operations: RoutingOperationEditorDto[];
  selectedOperationId: string | null;
  validationIssues: RoutingValidationIssueDto[];
  readOnly: boolean;
  onSelect: (operationId: string) => void;
  onAdd: () => void;
  onMove: (operationId: string, direction: "up" | "down") => void;
  onDuplicate: (operationId: string) => void;
  onRemove: (operationId: string) => void;
}

export function RoutingOperationList({
  operations,
  selectedOperationId,
  validationIssues,
  readOnly,
  onSelect,
  onAdd,
  onMove,
  onDuplicate,
  onRemove,
}: RoutingOperationListProps) {
  const issuesByOperation = new Map<string, RoutingValidationIssueDto[]>();
  for (const issue of validationIssues) {
    if (!issue.operationId) continue;
    const list = issuesByOperation.get(issue.operationId) ?? [];
    list.push(issue);
    issuesByOperation.set(issue.operationId, list);
  }

  if (operations.length === 0) {
    return (
      <div className="p-4 text-sm text-muted">
        <p>Technologický postup zatím neobsahuje žádnou operaci.</p>
        {!readOnly && (
          <button onClick={onAdd} className="mt-2 rounded border border-accent px-3 py-1 text-sm text-accent hover:bg-accent/10">
            Přidat první operaci
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <ul className="divide-y divide-border">
        {operations.map((operation) => {
          const issues = issuesByOperation.get(operation.id) ?? [];
          const hasError = issues.some((i) => i.severity === "error");
          const hasWarning = issues.some((i) => i.severity === "warning");
          const isSelected = operation.id === selectedOperationId;

          return (
            <li key={operation.id}>
              <button
                onClick={() => onSelect(operation.id)}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-surface-raised ${isSelected ? "bg-surface-raised" : ""}`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-muted">{operation.sequence}</span>
                  <span className="flex-1 truncate">{operation.name}</span>
                  {hasError && (
                    <span className="rounded bg-danger/20 px-1.5 py-0.5 text-xs text-danger" title="Postup obsahuje blokující chybu">
                      chyba
                    </span>
                  )}
                  {!hasError && hasWarning && (
                    <span className="rounded bg-accent/20 px-1.5 py-0.5 text-xs text-accent" title="Upozornění">
                      !
                    </span>
                  )}
                </div>
                <div className="mt-0.5 truncate text-xs text-muted">
                  {resourceLabel(operation)}
                  {(operation.machineInactive || operation.externalResourceInactive) && " (neaktivní)"}
                </div>
                <div className="mt-0.5 flex gap-3 text-xs text-muted">
                  <span>Příprava: {formatMinutes(operation.setupTimeMinutes)}</span>
                  <span>Kusový čas: {formatMinutes(operation.unitTimeMinutes ?? operation.calculatedTimeMinutes)}</span>
                </div>
              </button>
              {!readOnly && (
                <div className="flex gap-1 px-3 pb-2 text-xs text-muted">
                  <button onClick={() => onMove(operation.id, "up")} className="rounded border border-border px-1.5 hover:border-accent" aria-label="Posunout nahoru">
                    ↑
                  </button>
                  <button onClick={() => onMove(operation.id, "down")} className="rounded border border-border px-1.5 hover:border-accent" aria-label="Posunout dolů">
                    ↓
                  </button>
                  <button onClick={() => onDuplicate(operation.id)} className="rounded border border-border px-1.5 hover:border-accent">
                    Kopírovat
                  </button>
                  <button onClick={() => onRemove(operation.id)} className="rounded border border-border px-1.5 text-danger hover:border-danger">
                    Odstranit
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {!readOnly && (
        <button onClick={onAdd} className="m-3 rounded border border-accent px-3 py-1.5 text-sm text-accent hover:bg-accent/10">
          + Přidat operaci
        </button>
      )}
    </div>
  );
}
