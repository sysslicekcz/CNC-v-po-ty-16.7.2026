// Výpočetní jádro CNC časovače.
// Port z původního VBA doplňku (Module1/Module2), s opravenými chybami:
//  1) Příčné soustružení: nahrazena natvrdo zapsaná konstanta π (delkaDrahy = 3.14159...)
//     skutečnou radiální vzdáleností kroku — počítáno stejným principem jako u
//     Podélného soustružení (otáčky na průměrném průměru).
//  2) Broušení na kulato: sloupec „Otáčky obrobku (No)“ se nyní bere jako přímé
//     zadání otáček [ot/min], ne jako odvozená rychlost z Vo — odpovídá popisku sloupce.
//  3) Přípravné časy: řádek bez vyplněného počtu úkonů se už netiše zahazuje,
//     ale vrací se jako varování (warning), aby bylo vidět, že chybí do součtu.

const PI = Math.PI;

export interface OpResult {
  label: string;
  kontura: string;
  cas: number | null; // null = chyba/varování
  note?: string;
}

export interface CalcOutput {
  rows: OpResult[];
  total: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// ---------- Podélné soustružení (vnější i vnitřní sdílí stejný vzorec) ----------
export interface PodelneRow {
  kontura: string;
  Dc: number; // počáteční průměr
  Df: number; // koncový průměr
  L: number; // délka úseku
  fHrub: number;
  fDok: number;
  VcHrub: number;
  VcDok: number;
  ap: number;
}

export function calcPodelne(rows: PodelneRow[], typ: string): CalcOutput {
  const out: OpResult[] = [];
  let total = 0;
  for (const r of rows) {
    if (!(r.L > 0)) continue;
    const dAvg = (r.Dc + r.Df) / 2;
    const pocetPruchodu = Math.ceil(Math.abs(r.Dc - r.Df) / (2 * r.ap));
    const nHrub = (1000 * r.VcHrub) / (PI * dAvg);
    const casHrub = pocetPruchodu * (r.L / (r.fHrub * nHrub));
    out.push({ label: `Hrubování (${typ})`, kontura: r.kontura, cas: round2(casHrub) });
    total += casHrub;

    const nDok = (1000 * r.VcDok) / (PI * dAvg);
    const casDok = r.L / (r.fDok * nDok);
    out.push({ label: `Dokončování (${typ})`, kontura: r.kontura, cas: round2(casDok) });
    total += casDok;
  }
  return { rows: out, total: round2(total) };
}

// ---------- Příčné soustružení (OPRAVENO) ----------
export interface PricneRow {
  kontura: string;
  W: number; // šířka čelní plochy
  D: number; // průměr obrobku
  d: number; // konečný průměr
  f: number;
  Vc: number;
  ap: number;
}

export function calcPricne(rows: PricneRow[]): CalcOutput {
  const out: OpResult[] = [];
  let total = 0;
  for (const r of rows) {
    if (!(r.W > 0)) continue;
    const pocetPruchodu = Math.ceil(r.W / r.ap);
    const dAvg = (r.D + r.d) / 2;
    const n = (1000 * r.Vc) / (PI * dAvg);
    const radialniVzdalenost = (r.D - r.d) / 2;
    const casJednohoPruchodu = radialniVzdalenost / (r.f * n);
    const cas = pocetPruchodu * casJednohoPruchodu;
    out.push({ label: "Příčné soustružení", kontura: r.kontura, cas: round2(cas) });
    total += cas;
  }
  return { rows: out, total: round2(total) };
}

// ---------- Vrtání ----------
export interface VrtaniRow {
  kontura: string;
  pocetDer: number;
  D: number;
  L: number;
  f: number;
  Vc: number;
}

export function calcVrtani(rows: VrtaniRow[]): CalcOutput {
  const out: OpResult[] = [];
  let total = 0;
  for (const r of rows) {
    if (!(r.pocetDer > 0)) continue;
    const n = (1000 * r.Vc) / (PI * r.D);
    const cas = r.pocetDer * (r.L / (r.f * n));
    out.push({ label: "Vrtání", kontura: r.kontura, cas: round2(cas) });
    total += cas;
  }
  return { rows: out, total: round2(total) };
}

// ---------- Soustružení zápichu ----------
export interface ZapichRow {
  kontura: string;
  D1: number;
  D2: number;
  W: number;
  Fax: number;
  Vc: number;
  Wnuz: number;
  Rap: number;
}

export function calcZapich(rows: ZapichRow[]): CalcOutput {
  const out: OpResult[] = [];
  let total = 0;
  for (const r of rows) {
    if (!(r.D1 > r.D2 && r.W > 0 && r.Fax > 0 && r.Vc > 0 && r.Wnuz > 0 && r.Rap > 0)) {
      if (r.kontura) out.push({ label: "Soustružení zápichu", kontura: r.kontura, cas: null, note: "Chyba - neplatná data" });
      continue;
    }
    const delkaPruchodu = r.W - r.Wnuz;
    let aktualniPrumer = r.D1;
    let cas = 0;
    let guard = 0;
    while (aktualniPrumer > r.D2 && guard < 10000) {
      const n = (1000 * r.Vc) / (PI * aktualniPrumer);
      cas += delkaPruchodu / (r.Fax * n);
      aktualniPrumer -= r.Rap;
      guard++;
    }
    out.push({ label: "Soustružení zápichu", kontura: r.kontura, cas: round2(cas) });
    total += cas;
  }
  return { rows: out, total: round2(total) };
}

// ---------- Frézování pero drážek ----------
export interface FrezovaniRow {
  kontura: string;
  L: number;
  W: number;
  D: number;
  vf: number; // posuv mm/min
  Dc: number;
  apMax: number;
}

export function calcFrezovaniDrazek(rows: FrezovaniRow[]): CalcOutput {
  const out: OpResult[] = [];
  let total = 0;
  for (const r of rows) {
    if (!(r.L > 0 && r.W > 0 && r.D > 0 && r.vf > 0 && r.Dc > 0 && r.apMax > 0)) continue;
    const pocetPruchoduH = Math.ceil(r.D / r.apMax);
    const pocetPrejezduW = Math.ceil(r.W / r.Dc);
    const casPruchodu = r.L / r.vf;
    const cas = pocetPruchoduH * pocetPrejezduW * casPruchodu;
    out.push({ label: "Frézování pero drážek", kontura: r.kontura, cas: round2(cas) });
    total += cas;
  }
  return { rows: out, total: round2(total) };
}

// ---------- Broušení na kulato (OPRAVENO) ----------
export interface BrouseniRow {
  kontura: string;
  D1: number;
  D2: number;
  L: number;
  No: number; // otáčky obrobku [ot/min] - ZADÁVÁ SE PŘÍMO
  Vc: number; // řezná rychlost kotouče [m/s] - informativní, nepoužívá se v čase
  Dc: number; // průměr kotouče - informativní
  bs: number; // šířka kotouče
  ap: number; // hloubka úběru na vrstvu
  k: number; // poměr k šířce kotouče
}

export function calcBrouseniNaKulato(rows: BrouseniRow[]): CalcOutput {
  const out: OpResult[] = [];
  let total = 0;
  for (const r of rows) {
    if (!(r.D1 > r.D2 && r.L > 0 && r.No > 0 && r.bs > 0 && r.ap > 0 && r.k > 0)) continue;
    const s = r.k * r.bs;
    const vf = s * r.No;
    const celkovyUber = (r.D1 - r.D2) / 2;
    const pocetPruchodu = Math.ceil(celkovyUber / r.ap);
    const casPruchodu = r.L / vf;
    const cas = pocetPruchodu * casPruchodu;
    out.push({ label: "Broušení na kulato", kontura: r.kontura, cas: round2(cas) });
    total += cas;
  }
  return { rows: out, total: round2(total) };
}

// ---------- Čelní zápichy ----------
export interface CelniZapichRow {
  kontura: string;
  Dmax: number;
  Dmin: number;
  apZap: number;
  fZap: number;
  VcZap: number;
  Wnuz: number;
  apMax: number;
}

export function calcCelniZapichy(rows: CelniZapichRow[]): CalcOutput {
  const out: OpResult[] = [];
  let total = 0;
  for (const r of rows) {
    if (!(r.Dmax > r.Dmin && r.apZap > 0 && r.apMax > 0 && r.fZap > 0 && r.VcZap > 0 && r.Wnuz > 0)) {
      if (r.kontura) out.push({ label: "Čelní zápich", kontura: r.kontura, cas: null, note: "Chyba - neplatná data" });
      continue;
    }
    const pocetZ = Math.ceil(r.apZap / r.apMax);
    const sirkaZapichuX = (r.Dmax - r.Dmin) / 2;
    const otacky = (1000 * r.VcZap) / (PI * r.Dmax);
    const vf = r.fZap * otacky;
    const casJednohoPruchoduX = sirkaZapichuX / vf;
    const cas = casJednohoPruchoduX * pocetZ;
    out.push({ label: "Čelní zápich", kontura: r.kontura, cas: round2(cas) });
    total += cas;
  }
  return { rows: out, total: round2(total) };
}

// ---------- Přípravné časy (OPRAVENO: viditelné varování místo tichého zahození) ----------
export interface PripravaRow {
  nazev: string;
  cas: number;
  pocet: number | null;
}

export function calcPripravneCasy(rows: PripravaRow[]): CalcOutput {
  const out: OpResult[] = [];
  let total = 0;
  for (const r of rows) {
    if (!r.nazev) continue;
    if (r.pocet === null || r.pocet === undefined || !(r.pocet > 0)) {
      out.push({
        label: "Přípravné časy",
        kontura: r.nazev,
        cas: null,
        note: "Varování - chybí počet úkonů, řádek se nezapočítává",
      });
      continue;
    }
    const cas = r.cas * r.pocet;
    out.push({ label: "Přípravné časy", kontura: r.nazev, cas: round2(cas) });
    total += cas;
  }
  return { rows: out, total: round2(total) };
}
