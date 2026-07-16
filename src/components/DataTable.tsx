"use client";

import { ColumnDef } from "@/lib/operations";
import { Row } from "@/lib/results";

function emptyRow(columns: ColumnDef[]): Row {
  const r: Row = {};
  for (const c of columns) r[c.key] = c.type === "number" ? null : "";
  return r;
}

export default function DataTable({
  columns,
  rows,
  onChange,
}: {
  columns: ColumnDef[];
  rows: Row[];
  onChange: (rows: Row[]) => void;
}) {
  const updateCell = (idx: number, key: string, value: string) => {
    const next = rows.slice();
    const col = columns.find((c) => c.key === key)!;
    next[idx] = {
      ...next[idx],
      [key]: col.type === "number" ? (value === "" ? null : Number(value)) : value,
    };
    onChange(next);
  };

  const addRow = () => onChange([...rows, emptyRow(columns)]);
  const removeRow = (idx: number) => onChange(rows.filter((_, i) => i !== idx));

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-surface-raised text-left">
            {columns.map((c) => (
              <th key={c.key} className="whitespace-nowrap border-b border-border px-3 py-2 font-medium text-muted">
                {c.label}
                {c.unit ? <span className="ml-1 text-muted/70">[{c.unit}]</span> : null}
              </th>
            ))}
            <th className="w-10 border-b border-border" />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length + 1} className="px-3 py-6 text-center text-muted">
                Zatím žádné kontury. Přidej řádek tlačítkem níže.
              </td>
            </tr>
          )}
          {rows.map((row, idx) => (
            <tr key={idx} className="border-b border-border/60 last:border-0 hover:bg-surface-raised/50">
              {columns.map((c) => (
                <td key={c.key} className="px-2 py-1">
                  <input
                    type={c.type === "number" ? "number" : "text"}
                    step="any"
                    value={row[c.key] === null || row[c.key] === undefined ? "" : row[c.key]!}
                    onChange={(e) => updateCell(idx, c.key, e.target.value)}
                    placeholder={c.type === "number" ? "0" : "—"}
                    className="tabular w-full min-w-[6.5rem] rounded border border-transparent bg-transparent px-2 py-1 outline-none focus:border-accent focus:bg-surface"
                  />
                </td>
              ))}
              <td className="px-2 py-1 text-center">
                <button
                  onClick={() => removeRow(idx)}
                  aria-label="Smazat řádek"
                  className="text-muted transition hover:text-danger"
                >
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t border-border p-2">
        <button
          onClick={addRow}
          className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground transition hover:border-accent hover:text-accent"
        >
          + Přidat konturu
        </button>
      </div>
    </div>
  );
}
