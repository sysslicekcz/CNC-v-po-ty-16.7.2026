import {
  calcPodelne,
  calcPricne,
  calcVrtani,
  calcZapich,
  calcFrezovaniDrazek,
  calcBrouseniNaKulato,
  calcCelniZapichy,
  calcPripravneCasy,
  CalcOutput,
} from "./calc";

export type Row = Record<string, string | number | null>;

const num = (v: string | number | null | undefined): number =>
  v === null || v === undefined || v === "" ? 0 : Number(v);

export function computeOperation(id: string, rows: Row[]): CalcOutput {
  switch (id) {
    case "podelneVnejsi":
      return calcPodelne(
        rows.map((r) => ({
          kontura: String(r.kontura ?? ""),
          Dc: num(r.Dc),
          Df: num(r.Df),
          L: num(r.L),
          fHrub: num(r.fHrub),
          fDok: num(r.fDok),
          VcHrub: num(r.VcHrub),
          VcDok: num(r.VcDok),
          ap: num(r.ap),
        })),
        "Vnější"
      );
    case "podelneVnitrni":
      return calcPodelne(
        rows.map((r) => ({
          kontura: String(r.kontura ?? ""),
          Dc: num(r.Dc),
          Df: num(r.Df),
          L: num(r.L),
          fHrub: num(r.fHrub),
          fDok: num(r.fDok),
          VcHrub: num(r.VcHrub),
          VcDok: num(r.VcDok),
          ap: num(r.ap),
        })),
        "Vnitřní"
      );
    case "pricne":
      return calcPricne(
        rows.map((r) => ({
          kontura: String(r.kontura ?? ""),
          W: num(r.W),
          D: num(r.D),
          d: num(r.d),
          f: num(r.f),
          Vc: num(r.Vc),
          ap: num(r.ap),
        }))
      );
    case "vrtani":
      return calcVrtani(
        rows.map((r) => ({
          kontura: String(r.kontura ?? ""),
          pocetDer: num(r.pocetDer),
          D: num(r.D),
          L: num(r.L),
          f: num(r.f),
          Vc: num(r.Vc),
        }))
      );
    case "zapich":
      return calcZapich(
        rows.map((r) => ({
          kontura: String(r.kontura ?? ""),
          D1: num(r.D1),
          D2: num(r.D2),
          W: num(r.W),
          Fax: num(r.Fax),
          Vc: num(r.Vc),
          Wnuz: num(r.Wnuz),
          Rap: num(r.Rap),
        }))
      );
    case "frezovaniDrazek":
      return calcFrezovaniDrazek(
        rows.map((r) => ({
          kontura: String(r.kontura ?? ""),
          L: num(r.L),
          W: num(r.W),
          D: num(r.D),
          vf: num(r.vf),
          Dc: num(r.Dc),
          apMax: num(r.apMax),
        }))
      );
    case "brouseniNaKulato":
      return calcBrouseniNaKulato(
        rows.map((r) => ({
          kontura: String(r.kontura ?? ""),
          D1: num(r.D1),
          D2: num(r.D2),
          L: num(r.L),
          No: num(r.No),
          Vc: num(r.Vc),
          Dc: num(r.Dc),
          bs: num(r.bs),
          ap: num(r.ap),
          k: num(r.k),
        }))
      );
    case "celniZapichy":
      return calcCelniZapichy(
        rows.map((r) => ({
          kontura: String(r.kontura ?? ""),
          Dmax: num(r.Dmax),
          Dmin: num(r.Dmin),
          apZap: num(r.apZap),
          fZap: num(r.fZap),
          VcZap: num(r.VcZap),
          Wnuz: num(r.Wnuz),
          apMax: num(r.apMax),
        }))
      );
    case "pripravneCasy":
      return calcPripravneCasy(
        rows.map((r) => ({
          nazev: String(r.nazev ?? ""),
          cas: num(r.cas),
          pocet: r.pocet === null || r.pocet === undefined || r.pocet === "" ? null : Number(r.pocet),
        }))
      );
    default:
      return { rows: [], total: 0 };
  }
}
