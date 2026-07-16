"use client";

import { useEffect, useState } from "react";
import { Row } from "./results";
import { get, put } from "./db";

interface ToolRowsRecord {
  opId: string;
  rows: Row[];
}

// Katalog nástrojů je globální (nezávislý na dílu) - jeden záznam v IndexedDB
// store "toolRows" na operaci.
function useToolRows(opId: string) {
  const [rows, setRows] = useState<Row[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    get<ToolRowsRecord>("toolRows", opId).then((rec) => {
      setRows(rec?.rows ?? []);
      setHydrated(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- jednorázové načtení po mountu
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    put<ToolRowsRecord>("toolRows", { opId, rows });
  }, [rows, hydrated, opId]);

  return { rows, setRows, hydrated };
}

// Stejný princip jako useAllPartRows: explicitní volání (ne smyčka) kvůli Rules of Hooks
// — sada operací s nástroji je statická, takže je to ekvivalent pevného seznamu
// useState volání.
export function useAllTools() {
  const podelneVnejsi = useToolRows("podelneVnejsi");
  const podelneVnitrni = useToolRows("podelneVnitrni");
  const pricne = useToolRows("pricne");
  const vrtani = useToolRows("vrtani");
  const zapich = useToolRows("zapich");
  const frezovaniDrazek = useToolRows("frezovaniDrazek");
  const brouseniNaKulato = useToolRows("brouseniNaKulato");
  const celniZapichy = useToolRows("celniZapichy");

  const hydrated =
    podelneVnejsi.hydrated &&
    podelneVnitrni.hydrated &&
    pricne.hydrated &&
    vrtani.hydrated &&
    zapich.hydrated &&
    frezovaniDrazek.hydrated &&
    brouseniNaKulato.hydrated &&
    celniZapichy.hydrated;

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
    } as Record<string, (rows: Row[]) => void>,
  };
}
