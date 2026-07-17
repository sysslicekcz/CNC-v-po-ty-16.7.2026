"use client";

import { useState } from "react";

interface EntityItem {
  id: string;
  nazev: string;
}

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
  renderExtra,
  canRemove,
}: {
  title: string;
  items: T[];
  hydrated: boolean;
  onAdd: (nazev: string) => void;
  onRemove: (id: string) => void;
  onOpen: (item: T) => void;
  addPlaceholder: string;
  emptyMessage: string;
  deleteNoun: string;
  /** Volitelný extra obsah za názvem položky (např. dopočítaný čas). */
  renderExtra?: (item: T) => React.ReactNode;
  /** Volitelně skryje tlačítko smazat u položek, které nejde smazat (výchozí: vždy lze). */
  canRemove?: (item: T) => boolean;
}) {
  const [filter, setFilter] = useState("");
  const [newName, setNewName] = useState("");
  const [sortAz, setSortAz] = useState(false);

  const q = filter.trim().toLocaleLowerCase("cs");
  const filtered = q ? items.filter((i) => i.nazev.toLocaleLowerCase("cs").includes(q)) : items;
  const sorted = sortAz ? [...filtered].sort((a, b) => a.nazev.localeCompare(b.nazev, "cs")) : filtered;

  const submitAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setNewName("");
  };

  const remove = (item: T) => {
    if (!window.confirm(`Smazat ${deleteNoun} „${item.nazev}“? Smažou se i všechna navazující data.`)) return;
    onRemove(item.id);
  };

  if (!hydrated) return null;

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
            onClick={() => setSortAz((v) => !v)}
            className="rounded-md border border-border px-3 py-1.5 text-sm text-muted transition hover:border-accent hover:text-accent"
          >
            Řazení: {sortAz ? "A-Z" : "Nejnovější"}
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
                  <span>{item.nazev}</span>
                  {renderExtra && <span className="tabular text-muted">{renderExtra(item)}</span>}
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

      <form onSubmit={submitAdd} className="flex max-w-sm gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={addPlaceholder}
          className="flex-1 rounded border border-border bg-transparent px-3 py-1.5 text-sm outline-none focus:border-accent"
        />
        <button
          type="submit"
          className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground transition hover:border-accent hover:text-accent"
        >
          + Přidat
        </button>
      </form>
    </div>
  );
}
