"use client";

import { useEffect } from "react";
import { ensureAppBootstrapped } from "@/presentation/bootstrap/ensure-app-bootstrapped";

/**
 * Spustí `load()` při připojení komponenty/změně závislosti. Vytažené do
 * sdílené utility (místo `useEffect(() => { void reload(); }, [reload])`
 * přímo na každé stránce kmenových dat), protože `reload` definované lokálně
 * přes `useCallback` ve stejném souboru spouští
 * `react-hooks/set-state-in-effect` (ESLint umí dohledat, že tělo funkce
 * volá `setState`) - stejný důvod, proč `routing-sheet-editor-page.tsx`
 * (Krok 4) volá `editor.load(...)` přes objekt z jiného hooku místo lokální
 * funkce (viz komentář tamtéž u `effectiveSelectedOperationId`). Tahle
 * utilita dělá totéž záměrně - `load` je tu jen neprůhledný parametr, ne
 * lokálně inferovatelná funkce.
 */
export function useMasterDataReload(load: () => Promise<void>): void {
  useEffect(() => {
    void ensureAppBootstrapped().then(load);
  }, [load]);
}
