"use client";

import { useEffect, useState } from "react";
import { Row } from "./results";
import { get, put } from "./db";

interface ToolRowsRecord {
  id: string;
  strojId: string;
  opId: string;
  rows: Row[];
}

// Katalog nástrojů je teď per stroj (dřív byl globální, jeden na operaci) - záznam
// v IndexedDB store "toolRows" je pod klíčem `${strojId}:${opId}`. Bez vybraného
// stroje (strojId undefined) není co načítat - "rows"/"hydrated" se v tom případě
// jen odvodí (žádný stroj = prázdný katalog, rovnou hydrated), appka nespadne
// (viz ToolsView v CncApp.tsx, kde je výběr stroje pro editaci katalogu povinný).
function useToolRows(strojId: string | undefined, opId: string) {
  const id = strojId ? `${strojId}:${opId}` : null;
  // Poslední úspěšně načtený/uložený stav pro konkrétní "id" - drží se zvlášť od
  // odvozeného "rows" níže, ať přepnutí stroje (jiné "id") nikdy neukáže rows
  // z předchozího stroje, dokud se nenačtou ty správné.
  const [loaded, setLoaded] = useState<{ id: string; rows: Row[] } | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    get<ToolRowsRecord>("toolRows", id).then((rec) => {
      if (!cancelled) setLoaded({ id, rows: rec?.rows ?? [] });
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const hydrated = id === null || loaded?.id === id;
  const rows = id !== null && loaded?.id === id ? loaded.rows : [];

  const setRows = (next: Row[]) => {
    if (!id) return; // bez vybraného stroje není kam ukládat - UI editaci v tom stavu nenabízí
    setLoaded({ id, rows: next });
  };

  useEffect(() => {
    if (!id || !strojId || loaded?.id !== id) return;
    put<ToolRowsRecord>("toolRows", { id, strojId, opId, rows: loaded.rows });
  }, [loaded, id, strojId, opId]);

  return { rows, setRows, hydrated };
}

// Stejný princip jako useAllPartRows: explicitní volání (ne smyčka) kvůli Rules of Hooks
// — sada operací s nástroji je statická, takže je to ekvivalent pevného seznamu
// useState volání.
export function useAllTools(strojId: string | undefined) {
  const podelneVnejsi = useToolRows(strojId, "podelneVnejsi");
  const podelneVnitrni = useToolRows(strojId, "podelneVnitrni");
  const pricne = useToolRows(strojId, "pricne");
  const vrtani = useToolRows(strojId, "vrtani");
  const zapich = useToolRows(strojId, "zapich");
  const frezovaniDrazek = useToolRows(strojId, "frezovaniDrazek");
  const brouseniNaKulato = useToolRows(strojId, "brouseniNaKulato");
  const celniZapichy = useToolRows(strojId, "celniZapichy");
  const pripravneCasy = useToolRows(strojId, "pripravneCasy");

  const hydrated =
    podelneVnejsi.hydrated &&
    podelneVnitrni.hydrated &&
    pricne.hydrated &&
    vrtani.hydrated &&
    zapich.hydrated &&
    frezovaniDrazek.hydrated &&
    brouseniNaKulato.hydrated &&
    celniZapichy.hydrated &&
    pripravneCasy.hydrated;

  return {
    hydrated,
    byId: {
      podelneVnejsi: podelneVnejsi.rows,
      podelneVnitrni: podelneVnitrni.rows,
      pricne: pricne.rows,
      vrtani: vrtani.rows,
      zapich: zapich.rows,
      frezovaniDrazek: frezovaniDrazek.rows,
      brouseniNaKulato: brouseniNaKulato.rows,
      celniZapichy: celniZapichy.rows,
      pripravneCasy: pripravneCasy.rows,
    } as Record<string, Row[]>,
    setById: {
      podelneVnejsi: podelneVnejsi.setRows,
      podelneVnitrni: podelneVnitrni.setRows,
      pricne: pricne.setRows,
      vrtani: vrtani.setRows,
      zapich: zapich.setRows,
      frezovaniDrazek: frezovaniDrazek.setRows,
      brouseniNaKulato: brouseniNaKulato.setRows,
      celniZapichy: celniZapichy.setRows,
      pripravneCasy: pripravneCasy.setRows,
    } as Record<string, (rows: Row[]) => void>,
  };
}
