"use client";

import { useEffect } from "react";

/** Browser guard proti ztrátě neuložených změn (Krok 4, zadání bod 40) -
 *  reaguje jen na skutečný `dirty` stav, ne na "cokoliv se stalo" - po
 *  úspěšném autosave (`dirty === false`) se listener sám odregistruje, takže
 *  se dialog nezobrazuje při každém interním kliknutí. */
export function useUnsavedChangesGuard(dirty: boolean): void {
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
}
