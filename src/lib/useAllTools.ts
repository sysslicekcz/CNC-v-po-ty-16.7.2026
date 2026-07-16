"use client";

import { useLocalRows } from "./useLocalRows";
import { Row } from "./results";

// Stejný princip jako useAllRows: explicitní volání (ne smyčka) kvůli Rules of Hooks
// — sada operací s nástroji je statická, takže je to ekvivalent pevného seznamu
// useState volání. Klíče v localStorage mají namespace "nastroje:<id>", odlišný
// od klíčů s konturami dané operace.
export function useAllTools() {
  const podelneVnejsi = useLocalRows("nastroje:podelneVnejsi");
  const podelneVnitrni = useLocalRows("nastroje:podelneVnitrni");
  const pricne = useLocalRows("nastroje:pricne");
  const vrtani = useLocalRows("nastroje:vrtani");
  const zapich = useLocalRows("nastroje:zapich");
  const frezovaniDrazek = useLocalRows("nastroje:frezovaniDrazek");
  const brouseniNaKulato = useLocalRows("nastroje:brouseniNaKulato");
  const celniZapichy = useLocalRows("nastroje:celniZapichy");

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
