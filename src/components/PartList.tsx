"use client";

import { useState } from "react";
import { Part } from "@/lib/entities";

export default function PartList({
  items,
  hydrated,
  onAdd,
  onRemove,
  onOpen,
}: {
  items: Part[];
  hydrated: boolean;
  onAdd: (cisloVykresu: string, nazev: string) => void;
  onRemove: (id: string) => void;
  onOpen: (item: Part) => void;
}) {
  const [filter, setFilter] = useState("");
  const [cisloVykresu, setCisloVykresu] = useState("");
  const [nazev, setNazev] = useState("");
  const [sortMode, setSortMode] = useState<"newest" | "cislo" | "nazev">("newest");

  const q = filter.trim().toLocaleLowerCase("cs");
  const filtered = q
    ? items.filter(
        (i) =>
          i.nazev.toLocaleLowerCase("cs").includes(q) ||
          (i.cisloVykresu ?? "").toLocaleLowerCase("cs").includes(q)
      )
    : items;
  const sorted =
    sortMode === "cislo"
      ? [...filtered].sort((a, b) => (a.cisloVykresu ?? "").localeCompare(b.cisloVykresu ?? "", "cs", { numeric: true }))
      : sortMode === "nazev"
        ? [...filtered].sort((a, b) => a.nazev.localeCompare(b.nazev, "cs"))
        : filtered;

  const nextSortMode = { newest: "cislo", cislo: "nazev", nazev: "newest" } as const;
  const sortLabel = { newest: "Nejnovější", cislo: "Číslo výkresu", nazev: "Název" } as const;

  const submitAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const c = cisloVykresu.trim();
    const n = nazev.trim();
    if (!c || !n) return;
    onAdd(c, n);
    setCisloVykresu("");
    setNazev("");
  };

  const remove = (item: Part) => {
    const label = item.cisloVykresu ? `${item.cisloVykresu} – ${item.nazev}` : item.nazev;
    if (!window.confirm(`Smazat díl „${label}“? Smažou se i všechna navazující data.`)) return;
    onRemove(item.id);
  };

  if (!hydrated) return null;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">Díly</h2>

      {items.length > 3 && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filtrovat podle čísla výkresu nebo názvu…"
            className="w-full max-w-sm rounded border border-border bg-transparent px-3 py-1.5 text-sm outline-none focus:border-accent"
          />
          <button
            type="button"
            onClick={() => setSortMode(nextSortMode[sortMode])}
            className="rounded-md border border-border px-3 py-1.5 text-sm text-muted transition hover:border-accent hover:text-accent"
          >
            Řazení: {sortLabel[sortMode]}
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-border">
        {sorted.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted">
            {items.length === 0 ? "Zatím žádné díly. Založ první níže." : "Filtru neodpovídá žádný díl."}
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {sorted.map((item) => (
              <li key={item.id} className="flex items-center justify-between px-4 py-2 hover:bg-surface-raised/50">
                <button onClick={() => onOpen(item)} className="flex-1 text-left text-sm">
                  {item.cisloVykresu ? (
                    <>
                      <span className="tabular text-accent">{item.cisloVykresu}</span>
                      <span className="text-muted"> · </span>
                    </>
                  ) : null}
                  <span className="text-foreground">{item.nazev}</span>
                </button>
                <button
                  onClick={() => remove(item)}
                  aria-label="Smazat"
                  className="text-muted transition hover:text-danger"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form onSubmit={submitAdd} className="flex max-w-lg gap-2">
        <input
          type="text"
          value={cisloVykresu}
          onChange={(e) => setCisloVykresu(e.target.value)}
          placeholder="Číslo výkresu"
          className="w-36 rounded border border-border bg-transparent px-3 py-1.5 text-sm outline-none focus:border-accent"
        />
        <input
          type="text"
          value={nazev}
          onChange={(e) => setNazev(e.target.value)}
          placeholder="Název dílu"
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
