"use client";

export type MasterDataStatusFilter = "all" | "active" | "inactive";

export interface MasterDataToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  statusFilter: MasterDataStatusFilter;
  onStatusFilterChange: (value: MasterDataStatusFilter) => void;
  addLabel?: string;
  onAdd?: () => void;
}

/** Hledání + filtr stavu + tlačítko "přidat" - opakující se horní lišta
 *  seznamu kmenových dat (Krok 5), sdílená napříč entitami. Filtrování/hledání
 *  samotné zůstává na volající stránce (různé sloupce podle entity), tahle
 *  komponenta jen nese ovládací prvky. */
export function MasterDataToolbar({
  search,
  onSearchChange,
  searchPlaceholder = "Hledat…",
  statusFilter,
  onStatusFilterChange,
  addLabel,
  onAdd,
}: MasterDataToolbarProps) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <input
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder={searchPlaceholder}
        className="w-full max-w-sm rounded border border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:border-accent"
      />
      <select
        value={statusFilter}
        onChange={(e) => onStatusFilterChange(e.target.value as MasterDataStatusFilter)}
        className="rounded border border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:border-accent"
      >
        <option value="all">Všechny stavy</option>
        <option value="active">Aktivní</option>
        <option value="inactive">Neaktivní</option>
      </select>
      {onAdd && (
        <button onClick={onAdd} className="ml-auto rounded border border-accent px-3 py-1.5 text-sm text-accent hover:bg-accent/10">
          {addLabel ?? "+ Nový záznam"}
        </button>
      )}
    </div>
  );
}
