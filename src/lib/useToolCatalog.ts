"use client";

import { useEffect, useState } from "react";
import { Row } from "./results";
import { get, put } from "./db";

interface MachineRowsRecord {
  strojId: string;
  rows: Row[];
}

// Katalog nástrojů i šablony přípravných časů jsou teď každý jeden plochý seznam
// na stroj (store "tools"/"setupTemplates" v IndexedDB, keyPath "strojId") - stejný
// princip jako dřívější useToolRows (viz smazané lib/useAllTools.ts), jen bez fan-outu
// přes devět operací, protože katalog nástrojů už není vázaný na konkrétní operaci.
function useMachineRows(storeName: "tools" | "setupTemplates", strojId: string | undefined) {
  const id = strojId ?? null;
  // Poslední úspěšně načtený/uložený stav pro konkrétní "id" - drží se zvlášť od
  // odvozeného "rows" níže, ať přepnutí stroje (jiné "id") nikdy neukáže rows
  // z předchozího stroje, dokud se nenačtou ty správné.
  const [loaded, setLoaded] = useState<{ id: string; rows: Row[] } | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    get<MachineRowsRecord>(storeName, id).then((rec) => {
      if (!cancelled) setLoaded({ id, rows: rec?.rows ?? [] });
    });
    return () => {
      cancelled = true;
    };
  }, [storeName, id]);

  const hydrated = id === null || loaded?.id === id;
  const rows = id !== null && loaded?.id === id ? loaded.rows : [];

  const setRows = (next: Row[]) => {
    if (!id) return; // bez vybraného stroje není kam ukládat
    setLoaded({ id, rows: next });
  };

  useEffect(() => {
    if (!id || loaded?.id !== id) return;
    put<MachineRowsRecord>(storeName, { strojId: id, rows: loaded.rows });
  }, [storeName, loaded, id]);

  return { rows, setRows, hydrated };
}

/** Katalog nástrojů stroje (záložka "Nástroje" u detailu stroje) - obecný seznam,
 *  viz lib/toolCatalog.ts (TOOL_CATALOG_COLUMNS). */
export function useToolCatalog(strojId: string | undefined) {
  return useMachineRows("tools", strojId);
}

/** Šablony přípravných časů stroje (záložka "Seřízení" u detailu stroje) - stejný
 *  tvar jako dřív (název + čas), jen v samostatném store odděleném od nástrojů. */
export function useSetupTemplates(strojId: string | undefined) {
  return useMachineRows("setupTemplates", strojId);
}
