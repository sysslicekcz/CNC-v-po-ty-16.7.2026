"use client";

import { useId, useState } from "react";
import { ColumnDef } from "@/lib/operations";
import { Row } from "@/lib/results";

type SortDir = "asc" | "desc";

function compareValues(a: string | number | null, b: string | number | null, dir: SortDir): number {
  // Prázdné hodnoty vždy na konec, bez ohledu na směr řazení.
  const aEmpty = a === null || a === undefined || a === "";
  const bEmpty = b === null || b === undefined || b === "";
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;

  const cmp =
    typeof a === "number" && typeof b === "number"
      ? a - b
      : String(a).localeCompare(String(b), "cs", { numeric: true, sensitivity: "base" });
  return dir === "asc" ? cmp : -cmp;
}

export default function DataTable({
  columns,
  rows,
  onChange,
  konturaOptions,
  itemKind = "kontura",
}: {
  columns: ColumnDef[];
  rows: Row[];
  onChange: (rows: Row[]) => void;
  konturaOptions: string[];
  /** Ovlivňuje jen texty hlášek — "kontura" (výchozí) pro operace, "nastroj" pro
   *  katalog nástrojů, "sablona" pro šablony přípravných časů. */
  itemKind?: "kontura" | "nastroj" | "sablona";
}) {
  const listId = useId();
  const identKey = columns.find((c) => c.type === "text")?.key;
  const texts =
    itemKind === "nastroj"
      ? { empty: "Zatím žádné nástroje. Přidej nástroj tlačítkem výše." }
      : itemKind === "sablona"
        ? { empty: "Zatím žádné šablony. Přidej šablonu tlačítkem výše." }
        : { empty: "Zatím žádné kontury. Přidej konturu tlačítkem výše." };

  const [filterText, setFilterText] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const toggleSort = (key: string) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("asc");
    } else if (sortDir === "asc") {
      setSortDir("desc");
    } else {
      setSortKey(null);
    }
  };

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
    const deleteNoun = itemKind === "nastroj" ? "nástroj" : itemKind === "sablona" ? "šablonu" : "konturu";
    if (!window.confirm(`Smazat ${deleteNoun}${label ? ` „${label}“` : ""}?`)) return;
    onChange(rows.filter((_, i) => i !== idx));
  };

  // Index k původnímu poli se drží zvlášť, aby úpravy/mazání fungovaly správně
  // i po přefiltrování a přeřazení zobrazených řádků.
  let visible = rows.map((row, originalIndex) => ({ row, originalIndex }));

  const q = filterText.trim().toLocaleLowerCase("cs");
  if (q) {
    visible = visible.filter(({ row }) =>
      columns.some((c) => {
        const v = row[c.key];
        return v !== null && v !== undefined && String(v).toLocaleLowerCase("cs").includes(q);
      })
    );
  }

  if (sortKey) {
    const dir = sortDir;
    visible = [...visible].sort((a, b) => compareValues(a.row[sortKey], b.row[sortKey], dir));
  }

  return (
    // Full-bleed: tabulka sahá přes celou šířku obrazovky bez ohledu na to, že rodič
    // (stránka) má omezenou max-šířku - ať je co nejméně potřeba scrollovat v ose X.
    <div className="relative left-1/2 w-screen -translate-x-1/2 px-4 sm:px-6 lg:px-8">
      {rows.length > 3 && (
        <input
          type="text"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          placeholder="Filtrovat…"
          className="mb-2 w-full max-w-xs rounded border border-border bg-transparent px-3 py-1.5 text-sm outline-none focus:border-accent"
        />
      )}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-surface-raised text-left">
              {columns.map((c) => (
                <th
                  key={c.key}
                  onClick={() => toggleSort(c.key)}
                  className="cursor-pointer select-none whitespace-nowrap border-b border-border px-3 py-2 font-medium text-muted transition hover:text-foreground"
                >
                  <div className="flex items-center gap-1">
                    <span>{c.label}</span>
                    <span className={sortKey === c.key ? "text-accent" : "text-muted/30"}>
                      {sortKey === c.key ? (sortDir === "asc" ? "▲" : "▼") : "↕"}
                    </span>
                  </div>
                  {c.unit ? <div className="font-normal text-muted/70">[{c.unit}]</div> : null}
                </th>
              ))}
              <th className="w-10 border-b border-border" />
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="px-3 py-6 text-center text-muted">
                  {rows.length === 0 ? texts.empty : "Filtru neodpovídá žádný řádek."}
                </td>
              </tr>
            )}
            {visible.map(({ row, originalIndex }) => {
              const rowStarted = identKey ? Boolean(row[identKey]) : true;
              return (
                <tr key={originalIndex} className="border-b border-border/60 last:border-0 hover:bg-surface-raised/50">
                  {columns.map((c) => {
                    const missing = c.type === "number" && rowStarted && (row[c.key] === null || row[c.key] === undefined);
                    return (
                      <td key={c.key} className="px-2 py-1">
                        {c.type === "select" ? (
                          <select
                            value={row[c.key] === null || row[c.key] === undefined ? "" : String(row[c.key])}
                            onChange={(e) => updateCell(originalIndex, c.key, e.target.value)}
                            className="w-full min-w-[8rem] rounded border border-transparent bg-transparent px-2 py-1 outline-none focus:border-accent focus:bg-surface"
                          >
                            <option value="" disabled>
                              —
                            </option>
                            {c.options?.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={c.type === "number" ? "number" : "text"}
                            step="any"
                            list={c.key === "kontura" ? listId : undefined}
                            value={row[c.key] === null || row[c.key] === undefined ? "" : row[c.key]!}
                            onChange={(e) => updateCell(originalIndex, c.key, e.target.value)}
                            placeholder={c.type === "number" ? "0" : "—"}
                            className={
                              "tabular w-full min-w-[6.5rem] rounded border bg-transparent px-2 py-1 outline-none focus:border-accent focus:bg-surface " +
                              (missing ? "border-danger/50 bg-danger/5" : "border-transparent")
                            }
                          />
                        )}
                      </td>
                    );
                  })}
                  <td className="px-2 py-1 text-center">
                    <button
                      onClick={() => removeRow(originalIndex)}
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
      </div>
    </div>
  );
}
