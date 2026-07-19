"use client";

import { OperationActivityEditorDto } from "@/application/routing-sheets/dto/routing-sheet-editor-dto";
import { Tool } from "@/domain/entities/tool";

export interface OperationActivityTableProps {
  activities: OperationActivityEditorDto[];
  tools: Tool[];
  readOnly: boolean;
  onAssignTool: (activityId: string, toolId: string | undefined) => void;
  onMove: (activityId: string, direction: "up" | "down") => void;
  onRemove: (activityId: string) => void;
  onOpenCalculation: (activityId: string) => void;
}

function formatMinutes(value: number | undefined): string {
  if (value === undefined) return "-";
  return value.toLocaleString("cs-CZ", { maximumFractionDigits: 2 });
}

/** Řádková tabulka - žádný velký modální formulář na jednu drobnou činnost
 *  (zadání Krok 4, bod 12). Přiřazení nástroje je inline `<select>`, otevření
 *  kalkulace je jedno tlačítko. */
export function OperationActivityTable({ activities, tools, readOnly, onAssignTool, onMove, onRemove, onOpenCalculation }: OperationActivityTableProps) {
  if (activities.length === 0) {
    return <p className="px-2 py-2 text-sm text-muted">Upnutí zatím neobsahuje žádné technologické činnosti.</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
          <th className="w-8 py-1">#</th>
          <th className="py-1">Činnost</th>
          <th className="py-1">Nástroj</th>
          <th className="py-1 text-right">Čas</th>
          <th className="py-1"></th>
        </tr>
      </thead>
      <tbody>
        {activities.map((activity, index) => (
          <tr key={activity.id} className="border-b border-border/50">
            <td className="py-1 font-mono text-muted">{index + 1}</td>
            <td className="py-1">
              <div>{activity.operationTypeName ?? activity.operationTypeId}</div>
              {activity.note && <div className="text-xs text-muted">{activity.note}</div>}
              {activity.calculationStaleByResourceChange && (
                <div className="text-xs text-accent">Kalkulace nemusí odpovídat aktuálním vstupům. Proveďte nový výpočet.</div>
              )}
            </td>
            <td className="py-1">
              {readOnly ? (
                activity.toolName ?? "-"
              ) : (
                <select
                  value={activity.toolId ?? ""}
                  onChange={(e) => onAssignTool(activity.id, e.target.value || undefined)}
                  className="rounded border border-border bg-transparent px-1 py-0.5 text-sm outline-none focus:border-accent"
                >
                  <option value="">- bez nástroje -</option>
                  {tools.map((tool) => (
                    <option key={tool.id} value={tool.id}>
                      {tool.code ? `${tool.code.toString()} – ${tool.nazev}` : tool.nazev}
                    </option>
                  ))}
                </select>
              )}
            </td>
            <td className="py-1 text-right tabular">
              {formatMinutes(activity.manualCorrectionMinutes ?? activity.timeMinutes)} min
            </td>
            <td className="py-1 text-right">
              <div className="flex justify-end gap-1 text-xs">
                <button onClick={() => onOpenCalculation(activity.id)} className="rounded border border-border px-1.5 hover:border-accent">
                  Kalkulace
                </button>
                {!readOnly && (
                  <>
                    <button onClick={() => onMove(activity.id, "up")} className="rounded border border-border px-1.5 hover:border-accent" aria-label="Posunout nahoru">
                      ↑
                    </button>
                    <button onClick={() => onMove(activity.id, "down")} className="rounded border border-border px-1.5 hover:border-accent" aria-label="Posunout dolů">
                      ↓
                    </button>
                    <button onClick={() => onRemove(activity.id)} className="rounded border border-border px-1.5 text-danger hover:border-danger">
                      ✕
                    </button>
                  </>
                )}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
