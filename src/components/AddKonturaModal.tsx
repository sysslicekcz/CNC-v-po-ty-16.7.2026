"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ColumnDef } from "@/lib/operations";
import { Row } from "@/lib/results";

function buildDefaultRow(columns: ColumnDef[], prevRow: Row | undefined, autoKontura: string | undefined): Row {
  const r: Row = {};
  for (const c of columns) {
    if (c.type !== "number") {
      r[c.key] = c.key === "kontura" && autoKontura !== undefined ? autoKontura : "";
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

/** Pole, na které se má přesunout fokus: u operací s automaticky číslovanou konturou
 *  je to první sloupec za ní, který se sám nepředvyplní (ani řetězením, ani z
 *  nástroje) - tedy první, co je opravdu potřeba dopsat ručně. U operací bez pole
 *  "kontura" (přípravné časy) zůstává fokus na prvním sloupci jako dřív. */
function getFocusKey(columns: ColumnDef[]): string | undefined {
  const identIdx = columns.findIndex((c) => c.type === "text");
  if (identIdx === -1 || columns[identIdx].key !== "kontura") return columns[0]?.key;
  const next = columns.slice(identIdx + 1).find((c) => !c.chainFrom && !c.fromTool);
  return next?.key ?? columns[identIdx]?.key;
}

export default function AddKonturaModal({
  title,
  columns,
  prevRow,
  konturaOptions,
  autoKonturaStart,
  tools,
  toolColumns,
  onSubmit,
  onClose,
}: {
  title: string;
  columns: ColumnDef[];
  prevRow: Row | undefined;
  konturaOptions: string[];
  /** Další volné číslo kontury napříč celým dílem - undefined u operací bez pole "kontura". */
  autoKonturaStart?: number;
  /** Katalog nástrojů dostupný pro tuto operaci (prázdné/chybí = žádný výběr nástroje). */
  tools?: Row[];
  /** Sloupce katalogu odpovídající poli "nazev" + fromTool polím této operace. */
  toolColumns?: ColumnDef[];
  onSubmit: (row: Row) => void;
  onClose: () => void;
}) {
  const isAutoNumbered = columns.some((c) => c.key === "kontura") && autoKonturaStart !== undefined;
  const [counter, setCounter] = useState(autoKonturaStart ?? 1);
  const [draft, setDraft] = useState<Row>(() =>
    buildDefaultRow(columns, prevRow, isAutoNumbered ? String(autoKonturaStart) : undefined)
  );
  const [toolSelectKey, setToolSelectKey] = useState(0);
  const [justAdded, setJustAdded] = useState(false);
  const listId = useId();
  const focusKey = getFocusKey(columns);
  const focusFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!justAdded) return;
    const t = setTimeout(() => setJustAdded(false), 1500);
    return () => clearTimeout(t);
  }, [justAdded]);

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

  // Enter (nebo tlačítko "Přidat a další") uloží konturu a rovnou připraví formulář
  // na další, ať se nemusí po každé kontuře znovu otevírat dialog.
  const handleAddAndContinue = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(draft);
    const nextCounter = counter + 1;
    setCounter(nextCounter);
    setDraft(buildDefaultRow(columns, draft, isAutoNumbered ? String(nextCounter) : undefined));
    setToolSelectKey((k) => k + 1);
    setJustAdded(true);
    focusFieldRef.current?.focus();
  };

  const handleAddAndClose = () => {
    onSubmit(draft);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
      <form
        onSubmit={handleAddAndContinue}
        className="max-h-[90vh] w-full overflow-y-auto rounded-t-xl border border-border bg-surface p-5 sm:max-w-md sm:rounded-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-medium">{title}</h3>
          {justAdded && <span className="text-sm text-ok">✓ Přidáno</span>}
        </div>
        {tools && tools.length > 0 && (
          <label key={toolSelectKey} className="mb-4 block text-sm">
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
                ref={c.key === focusKey ? focusFieldRef : undefined}
                autoFocus={c.key === focusKey}
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
            type="button"
            onClick={handleAddAndClose}
            className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground transition hover:border-accent hover:text-accent"
          >
            Přidat a zavřít
          </button>
          <button type="submit" className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-[#17130a]">
            Přidat a další
          </button>
        </div>
      </form>
    </div>
  );
}
