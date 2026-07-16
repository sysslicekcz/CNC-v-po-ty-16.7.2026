"use client";

import { useEffect, useState } from "react";
import { Row } from "./results";
import { get, put } from "./db";

interface PartOperationRowsRecord {
  id: string;
  partId: string;
  opId: string;
  rows: Row[];
}

/** Řádky jedné operace jednoho dílu, uložené v IndexedDB store "partOperationRows"
 *  pod klíčem "<partId>:<opId>". Stejný tvar jako dřívější useLocalRows. */
export function usePartOperationRows(partId: string, opId: string) {
  const id = `${partId}:${opId}`;
  const [rows, setRows] = useState<Row[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    get<PartOperationRowsRecord>("partOperationRows", id).then((rec) => {
      setRows(rec?.rows ?? []);
      setHydrated(true);
    });
  }, [id]);

  useEffect(() => {
    if (!hydrated) return;
    put<PartOperationRowsRecord>("partOperationRows", { id, partId, opId, rows });
  }, [rows, hydrated, id, partId, opId]);

  return { rows, setRows, hydrated };
}

// Explicitní volání (ne smyčka) kvůli Rules of Hooks — sada operací je statická,
// stejný princip jako dřívější useAllRows.
export function useAllPartRows(partId: string) {
  const podelneVnejsi = usePartOperationRows(partId, "podelneVnejsi");
  const podelneVnitrni = usePartOperationRows(partId, "podelneVnitrni");
  const pricne = usePartOperationRows(partId, "pricne");
  const vrtani = usePartOperationRows(partId, "vrtani");
  const zapich = usePartOperationRows(partId, "zapich");
  const frezovaniDrazek = usePartOperationRows(partId, "frezovaniDrazek");
  const brouseniNaKulato = usePartOperationRows(partId, "brouseniNaKulato");
  const celniZapichy = usePartOperationRows(partId, "celniZapichy");
  const pripravneCasy = usePartOperationRows(partId, "pripravneCasy");

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
