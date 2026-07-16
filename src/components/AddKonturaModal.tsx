"use client";

import { useEffect, useId, useState } from "react";
import { ColumnDef } from "@/lib/operations";
import { Row } from "@/lib/results";

function buildDefaultRow(columns: ColumnDef[], prevRow: Row | undefined): Row {
  const r: Row = {};
  for (const c of columns) {
    if (c.type !== "number") {
      r[c.key] = "";
      continue;
    }
    const sourceKey = c.chainFrom ?? c.key;
    const prevVal = prevRow ? prevRow[sourceKey] : undefined;
    r[c.key] = typeof prevVal === "number" ? prevVal : null;
  }
  return r;
}

export default function AddKonturaModal({
  title,
  columns,
  prevRow,
  konturaOptions,
  onSubmit,
  onClose,
}: {
  title: string;
  columns: ColumnDef[];
  prevRow: Row | undefined;
  konturaOptions: string[];
  onSubmit: (row: Row) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Row>(() => buildDefaultRow(columns, prevRow));
  const listId = useId();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const setField = (key: string, value: string, type: ColumnDef["type"]) => {
    setDraft((d) => ({ ...d, [key]: type === "number" ? (value === "" ? null : Number(value)) : value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(draft);
  };

  const firstKey = columns[0]?.key;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="max-h-[90vh] w-full overflow-y-auto rounded-t-xl border border-border bg-surface p-5 sm:max-w-md sm:rounded-xl"
      >
        <h3 className="mb-4 text-base font-medium">{title}</h3>
        <div className="space-y-3">
          {columns.map((c) => (
            <label key={c.key} className="block text-sm">
              <span className="mb-1 block text-muted">
                {c.label}
                {c.unit ? <span className="text-muted/70"> [{c.unit}]</span> : null}
              </span>
              <input
                autoFocus={c.key === firstKey}
                type={c.type === "number" ? "number" : "text"}
                step="any"
                list={c.key === "kontura" ? listId : undefined}
                value={draft[c.key] === null || draft[c.key] === undefined ? "" : draft[c.key]!}
                onChange={(e) => setField(c.key, e.target.value, c.type)}
                placeholder={c.type === "number" ? "0" : "—"}
                className="w-full rounded border border-border bg-transparent px-2 py-1.5 outline-none focus:border-accent"
              />
            </label>
          ))}
        </div>
        {konturaOptions.length > 0 && (
          <datalist id={listId}>
            {konturaOptions.map((k) => (
              <option key={k} value={k} />
            ))}
          </datalist>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-3 py-1.5 text-sm text-muted hover:text-foreground"
          >
            Zrušit
          </button>
          <button
            type="submit"
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-[#17130a]"
          >
            Přidat
          </button>
        </div>
      </form>
    </div>
  );
}
