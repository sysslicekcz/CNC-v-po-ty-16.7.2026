"use client";

import { useId, useState } from "react";
import { ColumnDef } from "@/lib/operations";
import { Row } from "@/lib/results";
import AddKonturaModal from "./AddKonturaModal";

export default function DataTable({
  title,
  columns,
  rows,
  onChange,
  konturaOptions,
  tools,
  toolColumns,
  itemKind = "kontura",
}: {
  title: string;
  columns: ColumnDef[];
  rows: Row[];
  onChange: (rows: Row[]) => void;
  konturaOptions: string[];
  tools?: Row[];
  toolColumns?: ColumnDef[];
  /** Ovlivňuje jen texty tlačítek/hlášek — "kontura" (výchozí) pro operace, "nastroj" pro katalog nástrojů. */
  itemKind?: "kontura" | "nastroj";
}) {
  const [showModal, setShowModal] = useState(false);
  const listId = useId();
  const identKey = columns.find((c) => c.type === "text")?.key;
  const texts =
    itemKind === "nastroj"
      ? { empty: "Zatím žádné nástroje. Přidej nástroj tlačítkem níže.", add: "+ Přidat nástroj", deleteNoun: "nástroj" }
      : { empty: "Zatím žádné kontury. Přidej konturu tlačítkem níže.", add: "+ Přidat konturu", deleteNoun: "konturu" };

  const updateCell = (idx: number, key: string, value: string) => {
    const next = rows.slice();
    const col = columns.find((c) => c.key === key)!;
    next[idx] = {
      ...next[idx],
      [key]: col.type === "number" ? (value === "" ? null : Number(value)) : value,
    };
    onChange(next);
  };

  const removeRow = (idx: number) => {
    const label = identKey ? String(rows[idx][identKey] ?? "") : "";
    if (!window.confirm(`Smazat ${texts.deleteNoun}${label ? ` „${label}“` : ""}?`)) return;
    onChange(rows.filter((_, i) => i !== idx));
  };

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
                {texts.empty}
              </td>
            </tr>
          )}
          {rows.map((row, idx) => {
            const rowStarted = identKey ? Boolean(row[identKey]) : true;
            return (
              <tr key={idx} className="border-b border-border/60 last:border-0 hover:bg-surface-raised/50">
                {columns.map((c) => {
                  const missing = c.type === "number" && rowStarted && (row[c.key] === null || row[c.key] === undefined);
                  return (
                    <td key={c.key} className="px-2 py-1">
                      <input
                        type={c.type === "number" ? "number" : "text"}
                        step="any"
                        list={c.key === "kontura" ? listId : undefined}
                        value={row[c.key] === null || row[c.key] === undefined ? "" : row[c.key]!}
                        onChange={(e) => updateCell(idx, c.key, e.target.value)}
                        placeholder={c.type === "number" ? "0" : "—"}
                        className={
                          "tabular w-full min-w-[6.5rem] rounded border bg-transparent px-2 py-1 outline-none focus:border-accent focus:bg-surface " +
                          (missing ? "border-danger/50 bg-danger/5" : "border-transparent")
                        }
                      />
                    </td>
                  );
                })}
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
            );
          })}
        </tbody>
      </table>
      {konturaOptions.length > 0 && (
        <datalist id={listId}>
          {konturaOptions.map((k) => (
            <option key={k} value={k} />
          ))}
        </datalist>
      )}
      <div className="border-t border-border p-2">
        <button
          onClick={() => setShowModal(true)}
          className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground transition hover:border-accent hover:text-accent"
        >
          {texts.add}
        </button>
      </div>
      {showModal && (
        <AddKonturaModal
          title={title}
          columns={columns}
          prevRow={rows[rows.length - 1]}
          konturaOptions={konturaOptions}
          tools={tools}
          toolColumns={toolColumns}
          onClose={() => setShowModal(false)}
          onSubmit={(row) => onChange([...rows, row])}
        />
      )}
    </div>
  );
}
