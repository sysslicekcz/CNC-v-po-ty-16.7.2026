"use client";

import { useLocalRows } from "./useLocalRows";
import { Row } from "./results";

// Explicit calls (not a loop) to respect the Rules of Hooks — the set of
// operations is static, so this is equivalent to a fixed list of useState calls.
//
// State for every operation lives here, in one place, keyed by operation id.
// Tabs (CncApp/OperationTab) only ever receive rows/setRows as props for the
// active id — they hold no per-operation state of their own, so switching
// tabs can never mix up which operation a row belongs to.
export function useAllRows() {
  const podelneVnejsi = useLocalRows("podelneVnejsi");
  const podelneVnitrni = useLocalRows("podelneVnitrni");
  const pricne = useLocalRows("pricne");
  const vrtani = useLocalRows("vrtani");
  const zapich = useLocalRows("zapich");
  const frezovaniDrazek = useLocalRows("frezovaniDrazek");
  const brouseniNaKulato = useLocalRows("brouseniNaKulato");
  const celniZapichy = useLocalRows("celniZapichy");
  const pripravneCasy = useLocalRows("pripravneCasy");

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
