"use client";

import { useState } from "react";

interface EntityItem {
  id: string;
  nazev: string;
}

export interface SortOption<T> {
  label: string;
  /** Vynechat u režimu "výchozí pořadí" (nejnovější napřed - o to se stará volající). */
  compare?: (a: T, b: T) => number;
}

export interface ExtraFieldDef {
  key: string;
  label: string;
  type?: "text" | "number";
  /** Kam se pole vloží v přidávacím formuláři vzhledem k názvu. Výchozí "after". */
  position?: "before" | "after";
}

const defaultSortOptions = <T extends EntityItem>(): SortOption<T>[] => [
  { label: "Nejnovější" },
  { label: "A-Z", compare: (a, b) => a.nazev.localeCompare(b.nazev, "cs") },
];

export default function EntityList<T extends EntityItem>({
  title,
  items,
  hydrated,
  onAdd,
  onRemove,
  onOpen,
  addPlaceholder,
  emptyMessage,
  deleteNoun,
  renderLabel,
  renderExtra,
  canRemove,
  extraField,
  sortOptions,
  filterPredicate,
  confirmLabel,
}: {
  title: string;
  items: T[];
  hydrated: boolean;
  onAdd: (fields: Record<string, string>) => void;
  onRemove: (id: string) => void;
  onOpen: (item: T) => void;
  addPlaceholder: string;
  emptyMessage: string;
  deleteNoun: string;
  /** Vlastní obsah hlavního labelu položky (výchozí: název). */
  renderLabel?: (item: T) => React.ReactNode;
  /** Volitelný extra obsah za názvem položky (např. dopočítaný čas, datum založení). */
  renderExtra?: (item: T) => React.ReactNode;
  /** Volitelně skryje tlačítko smazat u položek, které nejde smazat (výchozí: vždy lze). */
  canRemove?: (item: T) => boolean;
  /** Druhé pole v přidávacím formuláři (např. číslo výkresu, hodinová sazba). */
  extraField?: ExtraFieldDef;
  /** Vlastní režimy řazení (výchozí: Nejnovější / A-Z podle názvu). */
  sortOptions?: SortOption<T>[];
  /** Vlastní predikát filtrování (výchozí: hledá v názvu). */
  filterPredicate?: (item: T, q: string) => boolean;
  /** Text položky v potvrzovacím dialogu při mazání (výchozí: název). */
  confirmLabel?: (item: T) => string;
}) {
  const [filter, setFilter] = useState("");
  const [newName, setNewName] = useState("");
  const [newExtra, setNewExtra] = useState("");
  const [sortIdx, setSortIdx] = useState(0);

  const modes = sortOptions ?? defaultSortOptions<T>();
  const mode = modes[sortIdx % modes.length];
  const matches = filterPredicate ?? ((item: T, q: string) => item.nazev.toLocaleLowerCase("cs").includes(q));

  const q = filter.trim().toLocaleLowerCase("cs");
  const filtered = q ? items.filter((i) => matches(i, q)) : items;
  const sorted = mode.compare ? [...filtered].sort(mode.compare) : filtered;

  const submitAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    const extraTrimmed = newExtra.trim();
    if (!trimmed || (extraField && !extraTrimmed)) return;
    onAdd(extraField ? { nazev: trimmed, [extraField.key]: extraTrimmed } : { nazev: trimmed });
    setNewName("");
    setNewExtra("");
  };

  const remove = (item: T) => {
    const label = confirmLabel ? confirmLabel(item) : item.nazev;
    if (!window.confirm(`Smazat ${deleteNoun} „${label}“? Smažou se i všechna navazující data.`)) return;
    onRemove(item.id);
  };

  if (!hydrated) return null;

  const nameInput = (
    <input
      key="nazev"
      type="text"
      value={newName}
      onChange={(e) => setNewName(e.target.value)}
      placeholder={addPlaceholder}
      className="flex-1 rounded border border-border bg-transparent px-3 py-1.5 text-sm outline-none focus:border-accent"
    />
  );
  const extraInput = extraField && (
    <input
      key="extra"
      type={extraField.type ?? "text"}
      value={newExtra}
      onChange={(e) => setNewExtra(e.target.value)}
      placeholder={extraField.label}
      className="w-36 rounded border border-border bg-transparent px-3 py-1.5 text-sm outline-none focus:border-accent"
    />
  );

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">{title}</h2>

      {items.length > 3 && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filtrovat…"
            className="w-full max-w-sm rounded border border-border bg-transparent px-3 py-1.5 text-sm outline-none focus:border-accent"
          />
          <button
            type="button"
            onClick={() => setSortIdx((i) => (i + 1) % modes.length)}
            className="rounded-md border border-border px-3 py-1.5 text-sm text-muted transition hover:border-accent hover:text-accent"
          >
            Řazení: {mode.label}
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-border">
        {sorted.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted">
            {items.length === 0 ? emptyMessage : "Filtru neodpovídá žádná položka."}
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {sorted.map((item) => (
              <li key={item.id} className="flex items-center justify-between px-4 py-2 hover:bg-surface-raised/50">
                <button onClick={() => onOpen(item)} className="flex flex-1 items-center justify-between text-left text-sm text-foreground">
                  <span>{renderLabel ? renderLabel(item) : item.nazev}</span>
                  {renderExtra && <span className="tabular text-xs text-muted">{renderExtra(item)}</span>}
                </button>
                {(!canRemove || canRemove(item)) && (
                  <button
                    onClick={() => remove(item)}
                    aria-label="Smazat"
                    className="ml-3 text-muted transition hover:text-danger"
                  >
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <form onSubmit={submitAdd} className="flex max-w-lg gap-2">
        {extraField?.position === "before" ? (
          <>
            {extraInput}
            {nameInput}
          </>
        ) : (
          <>
            {nameInput}
            {extraInput}
          </>
        )}
        <button
          type="submit"
          className="shrink-0 rounded-md border border-border px-3 py-1.5 text-sm text-foreground transition hover:border-accent hover:text-accent"
        >
          + Přidat
        </button>
      </form>
    </div>
  );
}
