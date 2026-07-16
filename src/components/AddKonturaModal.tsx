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
    // Rozměry konkrétní kontury (délka, průměry, počty…) se liší řádek od řádku,
    // takže se nepředvyplňují. Přebírá se jen to, co je vázané na nástroj/proces
    // (fromTool - posuv, řezná rychlost, hloubka záběru…) a explicitní řetězení
    // (chainFrom - např. počáteční průměr navazuje na koncový průměr předchozí kontury).
    const shouldPrefill = Boolean(c.chainFrom) || Boolean(c.fromTool);
    if (!shouldPrefill) {
      r[c.key] = null;
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
  tools,
  toolColumns,
  onSubmit,
  onClose,
}: {
  title: string;
  columns: ColumnDef[];
  prevRow: Row | undefined;
  konturaOptions: string[];
  /** Katalog nástrojů dostupný pro tuto operaci (prázdné/chybí = žádný výběr nástroje). */
  tools?: Row[];
  /** Sloupce katalogu odpovídající poli "nazev" + fromTool polím této operace. */
  toolColumns?: ColumnDef[];
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

  const applyTool = (nazev: string) => {
    const tool = tools?.find((t) => t.nazev === nazev);
    if (!tool || !toolColumns) return;
    setDraft((d) => {
      const next = { ...d };
      for (const c of toolColumns) {
        if (c.key === "nazev") continue;
        next[c.key] = tool[c.key] ?? next[c.key];
      }
      return next;
    });
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
        {tools && tools.length > 0 && (
          <label className="mb-4 block text-sm">
            <span className="mb-1 block text-muted">Nástroj</span>
            <select
              defaultValue=""
              onChange={(e) => applyTool(e.target.value)}
              className="w-full rounded border border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:border-accent"
            >
              <option value="" disabled>
                Vyber nástroj z katalogu (nebo vyplň ručně)
              </option>
              {tools.map((t) => (
                <option key={String(t.nazev)} value={String(t.nazev)}>
                  {String(t.nazev)}
                </option>
              ))}
            </select>
          </label>
        )}
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
