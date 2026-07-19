"use client";

import { useState } from "react";
import { OperationActivityEditorDto } from "@/application/routing-sheets/dto/routing-sheet-editor-dto";
import { CalculationInputRow } from "@/domain/aggregates/routing-sheet/types";
import { OPERATIONS, ColumnDef } from "@/lib/operations";
import { FeatureGate } from "@/presentation/components/feature-gate";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { FeatureAccessSnapshot } from "@/application/licensing/feature-access-snapshot";

export interface CalculationPanelProps {
  activity: OperationActivityEditorDto;
  featureAccessSnapshot: FeatureAccessSnapshot | null;
  readOnly: boolean;
  onCalculate: (calculationType: string, inputParameters: CalculationInputRow[]) => Promise<void>;
  onClose: () => void;
}

function emptyRow(columns: ColumnDef[]): CalculationInputRow {
  const row: CalculationInputRow = {};
  for (const column of columns) {
    row[column.key] = column.type === "number" ? (column.default as number | undefined) ?? null : (column.default as string | undefined) ?? "";
  }
  return row;
}

/**
 * Napojení na EXISTUJÍCÍ kalkulační engine (zadání bod 22) - vstupní řádky
 * odpovídají `OPERATIONS`/`ColumnDef` z `src/lib/operations.ts` (stejný
 * číselník jako legacy appka), výpočet provede `CalculateOperationUseCase` přes
 * `LegacyCalculationEngine`. Zjednodušení oproti legacy `AddKonturaModal`:
 * žádné automatické řetězení hodnot mezi řádky (`chainFrom`) ani předvyplnění
 * z katalogu nástrojů (`fromTool`) - řádky se zadávají ručně. Zdokumentováno
 * jako vědomé zjednodušení, viz docs/step-4/known-limitations.md.
 */
export function CalculationPanel({ activity, featureAccessSnapshot, readOnly, onCalculate, onClose }: CalculationPanelProps) {
  const operationConfig = OPERATIONS.find((op) => op.id === activity.operationTypeCode || op.id === activity.operationTypeId);
  const columns = operationConfig?.columns ?? [];

  const [rows, setRows] = useState<CalculationInputRow[]>(
    activity.calculationInputParameters && activity.calculationInputParameters.length > 0
      ? activity.calculationInputParameters
      : [emptyRow(columns)]
  );
  const [busy, setBusy] = useState(false);

  if (!operationConfig) {
    return (
      <div className="p-4 text-sm text-danger">Neznámý typ kalkulace - nelze zobrazit vstupní formulář.</div>
    );
  }

  const updateCell = (rowIndex: number, key: string, value: string) => {
    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== rowIndex) return row;
        const column = columns.find((c) => c.key === key);
        const parsed = column?.type === "number" ? (value === "" ? null : Number(value)) : value;
        return { ...row, [key]: parsed };
      })
    );
  };

  const addRow = () => setRows((prev) => [...prev, emptyRow(columns)]);
  const removeRow = (index: number) => setRows((prev) => prev.filter((_, i) => i !== index));

  const handleCalculate = async () => {
    setBusy(true);
    try {
      await onCalculate(operationConfig.id, rows);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded border border-border bg-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium">Kalkulace - {operationConfig.title}</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground" aria-label="Zavřít">
            ✕
          </button>
        </div>

        {activity.calculationStaleByResourceChange && (
          <p className="mb-3 rounded border border-accent/40 bg-accent/5 p-2 text-xs text-accent">
            Kalkulace nemusí odpovídat aktuálním vstupům. Proveďte nový výpočet.
          </p>
        )}

        <table className="mb-3 w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-muted">
              {columns.map((c) => (
                <th key={c.key} className="py-1 pr-2">
                  {c.label}
                  {c.unit ? ` (${c.unit})` : ""}
                </th>
              ))}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-b border-border/50">
                {columns.map((column) => (
                  <td key={column.key} className="py-1 pr-2">
                    <input
                      type={column.type === "number" ? "number" : "text"}
                      value={row[column.key] ?? ""}
                      disabled={readOnly}
                      onChange={(e) => updateCell(rowIndex, column.key, e.target.value)}
                      className="w-24 rounded border border-border bg-transparent px-1 py-0.5 text-sm outline-none focus:border-accent"
                    />
                  </td>
                ))}
                <td>
                  {!readOnly && rows.length > 1 && (
                    <button onClick={() => removeRow(rowIndex)} className="text-xs text-danger hover:underline">
                      Odebrat
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!readOnly && (
          <button onClick={addRow} className="mb-3 rounded border border-border px-2 py-1 text-xs hover:border-accent">
            + Přidat řádek
          </button>
        )}

        {activity.calculationResult && (
          <div className="mb-3 rounded border border-border p-2 text-sm">
            <div className="text-xs uppercase tracking-wide text-muted">Poslední výsledek</div>
            <div className="tabular">{activity.calculationResult.total.toLocaleString("cs-CZ", { maximumFractionDigits: 2 })} min</div>
          </div>
        )}

        {!readOnly && (
          <FeatureGate
            snapshot={featureAccessSnapshot}
            feature={FeatureCodes.CalculationsBasic}
            requiredAccess="write"
            fallback={<p className="text-sm text-muted">Vaše licence neumožňuje vytvářet nové kalkulace.</p>}
            loading={<p className="text-sm text-muted">Načítám oprávnění…</p>}
          >
            <button
              onClick={handleCalculate}
              disabled={busy}
              className="rounded border border-accent px-3 py-1.5 text-sm text-accent hover:bg-accent/10 disabled:opacity-50"
            >
              {busy ? "Počítám…" : "Vypočítat"}
            </button>
          </FeatureGate>
        )}
      </div>
    </div>
  );
}
