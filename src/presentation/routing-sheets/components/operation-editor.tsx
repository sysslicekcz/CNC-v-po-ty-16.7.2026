"use client";

import { useState } from "react";
import { RoutingOperationEditorDto } from "@/application/routing-sheets/dto/routing-sheet-editor-dto";
import { OperationResourceAssignment } from "@/domain/aggregates/routing-sheet/operation";
import { Machine } from "@/domain/entities/machine";
import { ExternalOperationResource } from "@/domain/entities/external-operation-resource";
import { OperationType } from "@/domain/entities/operation-type";
import { Tool } from "@/domain/entities/tool";
import { RoutingValidationIssueDto } from "@/application/routing-sheets/dto/routing-validation-issue-dto";
import { ResourceSelector } from "./resource-selector";
import { OperationPositionList } from "./position-list";

export interface RoutingOperationEditorProps {
  operation: RoutingOperationEditorDto;
  machines: Machine[];
  externalResources: ExternalOperationResource[];
  operationTypes: OperationType[];
  tools: Tool[];
  canUseCooperations: boolean;
  readOnly: boolean;
  issues: RoutingValidationIssueDto[];
  onUpdate: (input: { name?: string; note?: string; setupTimeMinutes?: number; unitTimeMinutes?: number; transferBatchSize?: number }) => void;
  onAssignResource: (assignment: OperationResourceAssignment) => void;
  onAddPosition: () => void;
  onRenamePosition: (positionId: string, name: string) => void;
  onMovePosition: (positionId: string, direction: "up" | "down") => void;
  onRemovePosition: (positionId: string) => void;
  onAddActivity: (positionId: string, input: { operationTypeId: string; calculationType: string }) => void;
  onAssignTool: (positionId: string, activityId: string, toolId: string | undefined) => void;
  onMoveActivity: (positionId: string, activityId: string, direction: "up" | "down") => void;
  onRemoveActivity: (positionId: string, activityId: string) => void;
  onOpenCalculation: (positionId: string, activityId: string) => void;
}

function parseMinutes(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function RoutingOperationEditor({
  operation,
  machines,
  externalResources,
  operationTypes,
  tools,
  canUseCooperations,
  readOnly,
  issues,
  onUpdate,
  onAssignResource,
  onAddPosition,
  onRenamePosition,
  onMovePosition,
  onRemovePosition,
  onAddActivity,
  onAssignTool,
  onMoveActivity,
  onRemoveActivity,
  onOpenCalculation,
}: RoutingOperationEditorProps) {
  const [name, setName] = useState(operation.name);
  const [note, setNote] = useState(operation.note ?? "");

  return (
    <div className="space-y-4 p-4">
      {issues.length > 0 && (
        <ul className="space-y-1 rounded border border-danger/40 bg-danger/5 p-2 text-xs text-danger">
          {issues.map((issue) => (
            <li key={issue.id}>{issue.message}</li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs uppercase tracking-wide text-muted">Název operace</label>
          {readOnly ? (
            <div className="text-sm">{operation.name}</div>
          ) : (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => name !== operation.name && onUpdate({ name })}
              className="w-full rounded border border-border bg-transparent px-2 py-1 text-sm outline-none focus:border-accent"
            />
          )}
        </div>
        <div>
          <label className="mb-1 block text-xs uppercase tracking-wide text-muted">Poznámka</label>
          {readOnly ? (
            <div className="text-sm text-muted">{operation.note ?? "-"}</div>
          ) : (
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onBlur={() => note !== (operation.note ?? "") && onUpdate({ note })}
              className="w-full rounded border border-border bg-transparent px-2 py-1 text-sm outline-none focus:border-accent"
            />
          )}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs uppercase tracking-wide text-muted">Zdroj (stroj / kooperace)</label>
        {readOnly ? (
          <div className="text-sm">
            {operation.resourceType === "machine" && `${operation.machineCode} – ${operation.machineName}`}
            {operation.resourceType === "external" && `${operation.externalResourceCode} – ${operation.externalResourceName}`}
            {operation.resourceType === "unassigned" && "Bez přiřazeného zdroje"}
          </div>
        ) : (
          <ResourceSelector
            operation={operation}
            machines={machines}
            externalResources={externalResources}
            canUseCooperations={canUseCooperations}
            onChange={onAssignResource}
          />
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs uppercase tracking-wide text-muted">Přípravný čas (min)</label>
          {readOnly ? (
            <div className="text-sm tabular">{operation.setupTimeMinutes ?? "-"}</div>
          ) : (
            <input
              type="number"
              min={0}
              defaultValue={operation.setupTimeMinutes ?? ""}
              onBlur={(e) => onUpdate({ setupTimeMinutes: parseMinutes(e.target.value) })}
              className="w-full rounded border border-border bg-transparent px-2 py-1 text-sm outline-none focus:border-accent"
            />
          )}
        </div>
        <div>
          <label className="mb-1 block text-xs uppercase tracking-wide text-muted">Kusový čas (min)</label>
          {readOnly ? (
            <div className="text-sm tabular">{operation.unitTimeMinutes ?? "-"}</div>
          ) : (
            <input
              type="number"
              min={0}
              defaultValue={operation.unitTimeMinutes ?? ""}
              onBlur={(e) => onUpdate({ unitTimeMinutes: parseMinutes(e.target.value) })}
              className="w-full rounded border border-border bg-transparent px-2 py-1 text-sm outline-none focus:border-accent"
            />
          )}
        </div>
        <div>
          <label className="mb-1 block text-xs uppercase tracking-wide text-muted">Předávací dávka</label>
          {readOnly ? (
            <div className="text-sm tabular">{operation.transferBatchSize ?? "-"}</div>
          ) : (
            <input
              type="number"
              min={0}
              defaultValue={operation.transferBatchSize ?? ""}
              onBlur={(e) => onUpdate({ transferBatchSize: parseMinutes(e.target.value) })}
              className="w-full rounded border border-border bg-transparent px-2 py-1 text-sm outline-none focus:border-accent"
            />
          )}
        </div>
        <div>
          <label className="mb-1 block text-xs uppercase tracking-wide text-muted">Dopočtený čas (kalkulace)</label>
          <div className="text-sm tabular text-muted">{operation.calculatedTimeMinutes.toLocaleString("cs-CZ", { maximumFractionDigits: 2 })} min</div>
        </div>
      </div>

      {operation.externalReferences && operation.externalReferences.length > 0 && (
        <div className="rounded border border-border p-2 text-xs text-muted">
          <div className="mb-1 uppercase tracking-wide">Externí systémy</div>
          {operation.externalReferences.map((ref, i) => (
            <div key={i}>
              {ref.externalSystemName}: {ref.externalEntityType} / {ref.externalCode ?? ref.externalId}
            </div>
          ))}
        </div>
      )}

      <div>
        <h3 className="mb-2 text-sm font-medium">Upnutí</h3>
        <OperationPositionList
          positions={operation.positions}
          operationTypes={operationTypes}
          tools={tools}
          readOnly={readOnly}
          onAdd={onAddPosition}
          onRename={onRenamePosition}
          onMove={onMovePosition}
          onRemove={onRemovePosition}
          onAddActivity={onAddActivity}
          onAssignTool={onAssignTool}
          onMoveActivity={onMoveActivity}
          onRemoveActivity={onRemoveActivity}
          onOpenCalculation={onOpenCalculation}
        />
      </div>
    </div>
  );
}
