"use client";

import { useState } from "react";
import { OperationPositionEditorDto } from "@/application/routing-sheets/dto/routing-sheet-editor-dto";
import { OperationType } from "@/domain/entities/operation-type";
import { Tool } from "@/domain/entities/tool";
import { OperationActivityTable } from "./activity-table";
import { MACHINE_OPERATIONS } from "@/lib/operations";

export interface OperationPositionListProps {
  positions: OperationPositionEditorDto[];
  operationTypes: OperationType[];
  tools: Tool[];
  readOnly: boolean;
  onAdd: () => void;
  onRename: (positionId: string, name: string) => void;
  onMove: (positionId: string, direction: "up" | "down") => void;
  onRemove: (positionId: string) => void;
  onAddActivity: (positionId: string, input: { operationTypeId: string; calculationType: string }) => void;
  onAssignTool: (positionId: string, activityId: string, toolId: string | undefined) => void;
  onMoveActivity: (positionId: string, activityId: string, direction: "up" | "down") => void;
  onRemoveActivity: (positionId: string, activityId: string) => void;
  onOpenCalculation: (positionId: string, activityId: string) => void;
}

/** `Position.sortKey` je nepovinné pole (viz docs/audits/step-4-audit.md) - u
 *  legacy upnutí bez sortKey se `sequence` v DTO stejně vždy dopočítá
 *  deterministicky (pořadí v `positionList`), takže UI se tímhle nemusí
 *  zabývat. */
export function OperationPositionList({
  positions,
  operationTypes,
  tools,
  readOnly,
  onAdd,
  onRename,
  onMove,
  onRemove,
  onAddActivity,
  onAssignTool,
  onMoveActivity,
  onRemoveActivity,
  onOpenCalculation,
}: OperationPositionListProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [addingActivityFor, setAddingActivityFor] = useState<string | null>(null);
  const [newOperationTypeId, setNewOperationTypeId] = useState<string>(MACHINE_OPERATIONS[0]?.id ?? "");

  const toggle = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (positions.length === 0) {
    return (
      <div className="p-3 text-sm text-muted">
        <p>Operace zatím nemá žádné upnutí.</p>
        {!readOnly && (
          <button onClick={onAdd} className="mt-2 rounded border border-accent px-3 py-1 text-sm text-accent hover:bg-accent/10">
            Přidat upnutí
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {positions.map((position, index) => {
        const isCollapsed = collapsed.has(position.id);
        return (
          <div key={position.id} className="rounded border border-border">
            <div className="flex items-center gap-2 bg-surface-raised px-2 py-1.5">
              <button
                onClick={() => toggle(position.id)}
                aria-expanded={!isCollapsed}
                className="text-muted hover:text-foreground"
              >
                {isCollapsed ? "▸" : "▾"}
              </button>
              <span className="font-mono text-sm text-muted">Upnutí {index + 1}</span>
              {readOnly ? (
                <span className="text-sm">{position.name}</span>
              ) : (
                <input
                  defaultValue={position.name}
                  onBlur={(e) => e.target.value !== position.name && onRename(position.id, e.target.value)}
                  className="flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-sm outline-none focus:border-accent"
                />
              )}
              {!readOnly && (
                <div className="ml-auto flex gap-1 text-xs">
                  <button onClick={() => onMove(position.id, "up")} className="rounded border border-border px-1.5 hover:border-accent" aria-label="Posunout nahoru">
                    ↑
                  </button>
                  <button onClick={() => onMove(position.id, "down")} className="rounded border border-border px-1.5 hover:border-accent" aria-label="Posunout dolů">
                    ↓
                  </button>
                  <button onClick={() => onRemove(position.id)} className="rounded border border-border px-1.5 text-danger hover:border-danger">
                    Odstranit
                  </button>
                </div>
              )}
            </div>
            {!isCollapsed && (
              <div className="px-2 py-2">
                <OperationActivityTable
                  activities={position.activities}
                  tools={tools}
                  readOnly={readOnly}
                  onAssignTool={(activityId, toolId) => onAssignTool(position.id, activityId, toolId)}
                  onMove={(activityId, direction) => onMoveActivity(position.id, activityId, direction)}
                  onRemove={(activityId) => onRemoveActivity(position.id, activityId)}
                  onOpenCalculation={(activityId) => onOpenCalculation(position.id, activityId)}
                />
                {!readOnly && (
                  <div className="mt-2">
                    {addingActivityFor === position.id ? (
                      <div className="flex items-center gap-2">
                        <select
                          value={newOperationTypeId}
                          onChange={(e) => setNewOperationTypeId(e.target.value)}
                          className="rounded border border-border bg-transparent px-1 py-0.5 text-sm outline-none focus:border-accent"
                        >
                          {MACHINE_OPERATIONS.map((op) => (
                            <option key={op.id} value={op.id}>
                              {op.title}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => {
                            const operationType = operationTypes.find((t) => t.kod === newOperationTypeId) ?? operationTypes[0];
                            onAddActivity(position.id, {
                              operationTypeId: operationType?.id ?? newOperationTypeId,
                              calculationType: newOperationTypeId,
                            });
                            setAddingActivityFor(null);
                          }}
                          className="rounded border border-accent px-2 py-0.5 text-xs text-accent hover:bg-accent/10"
                        >
                          Přidat
                        </button>
                        <button onClick={() => setAddingActivityFor(null)} className="text-xs text-muted hover:text-foreground">
                          Zrušit
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAddingActivityFor(position.id)}
                        className="rounded border border-border px-2 py-1 text-xs hover:border-accent"
                      >
                        + Přidat činnost
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
      {!readOnly && (
        <button onClick={onAdd} className="rounded border border-accent px-3 py-1 text-sm text-accent hover:bg-accent/10">
          + Přidat upnutí
        </button>
      )}
    </div>
  );
}
