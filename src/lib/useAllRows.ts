"use client";

import { useLocalRows } from "./useLocalRows";

// Explicit calls (not a loop) to respect the Rules of Hooks — the set of
// operations is static, so this is equivalent to a fixed list of useState calls.
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
    } as Record<string, ReturnType<typeof useLocalRows>["rows"]>,
  };
}
