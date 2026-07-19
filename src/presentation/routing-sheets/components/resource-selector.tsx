"use client";

import { useMemo, useState } from "react";
import { Machine } from "@/domain/entities/machine";
import { ExternalOperationResource } from "@/domain/entities/external-operation-resource";
import { OperationResourceAssignment } from "@/domain/aggregates/routing-sheet/operation";
import { RoutingOperationEditorDto } from "@/application/routing-sheets/dto/routing-sheet-editor-dto";

export interface ResourceSelectorProps {
  operation: RoutingOperationEditorDto;
  machines: Machine[];
  externalResources: ExternalOperationResource[];
  canUseCooperations: boolean;
  onChange: (assignment: OperationResourceAssignment) => void;
}

/**
 * Společný výběr rozdělený na sekce "Stroje"/"Kooperace" (zadání Krok 4, bod 6) -
 * UI je jeden selector, ale doména ukládá `machineId`/`externalResourceId` jako
 * dva oddělené, vzájemně se vylučující typy (`OperationResourceAssignment`),
 * nikdy jeden nekontrolovaný `resourceId`. Neaktivní stroje/kooperace se
 * NENABÍZEJÍ pro nové přiřazení (zadání bod 7) - `machines`/`externalResources`
 * sem přicházejí už předfiltrované na aktivní (viz `useRoutingSheetEditor.availableMachines`).
 */
export function ResourceSelector({ operation, machines, externalResources, canUseCooperations, onChange }: ResourceSelectorProps) {
  const [query, setQuery] = useState("");

  const filteredMachines = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return machines;
    return machines.filter(
      (m) => m.code.toString().toLowerCase().includes(q) || m.name.toLowerCase().includes(q) || (m.designation ?? "").toLowerCase().includes(q)
    );
  }, [machines, query]);

  const filteredExternalResources = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return externalResources;
    return externalResources.filter((r) => r.code.toString().toLowerCase().includes(q) || r.name.toLowerCase().includes(q));
  }, [externalResources, query]);

  return (
    <div className="space-y-2">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Hledat podle kódu, názvu, označení…"
        className="w-full rounded border border-border bg-transparent px-2 py-1 text-sm outline-none focus:border-accent"
      />
      <div className="max-h-56 overflow-y-auto rounded border border-border">
        <button
          onClick={() => onChange({ type: "unassigned" })}
          className={`block w-full px-2 py-1.5 text-left text-sm hover:bg-surface-raised ${operation.resourceType === "unassigned" ? "bg-surface-raised" : ""}`}
        >
          Bez zdroje
        </button>

        <div className="border-t border-border px-2 py-1 text-xs uppercase tracking-wide text-muted">Stroje</div>
        {filteredMachines.length === 0 && <div className="px-2 py-1.5 text-sm text-muted">Nejsou dostupné žádné aktivní stroje.</div>}
        {filteredMachines.map((machine) => (
          <button
            key={machine.id}
            onClick={() => onChange({ type: "machine", machineId: machine.id })}
            className={`block w-full px-2 py-1.5 text-left text-sm hover:bg-surface-raised ${
              operation.resourceType === "machine" && operation.machineId === machine.id ? "bg-surface-raised" : ""
            }`}
          >
            {machine.code.toString()} – {machine.name}
          </button>
        ))}

        {canUseCooperations && (
          <>
            <div className="border-t border-border px-2 py-1 text-xs uppercase tracking-wide text-muted">Kooperace</div>
            {filteredExternalResources.length === 0 && (
              <div className="px-2 py-1.5 text-sm text-muted">Nejsou dostupné žádné aktivní kooperace.</div>
            )}
            {filteredExternalResources.map((resource) => (
              <button
                key={resource.id}
                onClick={() => onChange({ type: "external", externalResourceId: resource.id })}
                className={`block w-full px-2 py-1.5 text-left text-sm hover:bg-surface-raised ${
                  operation.resourceType === "external" && operation.externalResourceId === resource.id ? "bg-surface-raised" : ""
                }`}
              >
                {resource.code.toString()} – {resource.name}
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
