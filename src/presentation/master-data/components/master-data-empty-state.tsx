"use client";

/** Sjednocený prázdný stav pro seznamy kmenových dat (Krok 6 - UX dotažení).
 *  Rozlišuje "opravdu žádná data" (vysvětlení + tlačítko pro založení prvního
 *  záznamu) od "filtru nic neodpovídá" (jen krátká hláška). */
export function MasterDataEmptyState({
  hasAnyItems,
  noItemsMessage,
  noMatchMessage = "Žádná položka neodpovídá filtru.",
  onAdd,
  addLabel,
}: {
  hasAnyItems: boolean;
  noItemsMessage: string;
  noMatchMessage?: string;
  onAdd?: () => void;
  addLabel?: string;
}) {
  if (hasAnyItems) {
    return <p className="py-6 text-center text-sm text-muted">{noMatchMessage}</p>;
  }
  return (
    <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center">
      <p className="text-sm text-muted">{noItemsMessage}</p>
      {onAdd && (
        <button
          onClick={onAdd}
          className="mt-4 rounded border border-accent px-3 py-1.5 text-sm text-accent hover:bg-accent/10"
        >
          {addLabel ?? "+ Přidat první záznam"}
        </button>
      )}
    </div>
  );
}
