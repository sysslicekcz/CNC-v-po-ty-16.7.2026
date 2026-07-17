export type FieldType = "text" | "number";

export interface ColumnDef {
  key: string;
  label: string;
  unit?: string;
  type: FieldType;
  default?: number | string;
  /** Při zadávání nové kontury se výchozí hodnota převezme z tohoto pole předchozí kontury
   *  (místo ze stejnojmenného pole). Např. počáteční průměr nové kontury navazuje na koncový
   *  průměr té předchozí. */
  chainFrom?: string;
  /** Hodnota patří nástroji (posuv, řezná rychlost, rozměr nástroje…), ne konkrétní kontuře —
   *  jde tedy o pole, které lze uložit v katalogu nástrojů a při zadávání kontury z něj načíst. */
  fromTool?: boolean;
}

export interface OperationConfig {
  id: string;
  title: string;
  shortTitle: string;
  columns: ColumnDef[];
}

export const OPERATIONS: OperationConfig[] = [
  {
    id: "podelneVnejsi",
    title: "Podélné soustružení (vnější)",
    shortTitle: "Podélné vnější",
    columns: [
      { key: "kontura", label: "Kontura", type: "text" },
      { key: "Dc", label: "Počáteční průměr", unit: "mm", type: "number", chainFrom: "Df" },
      { key: "Df", label: "Koncový průměr", unit: "mm", type: "number" },
      { key: "L", label: "Délka úseku", unit: "mm", type: "number" },
      { key: "fHrub", label: "Posuv hrubování", unit: "mm/ot", type: "number", fromTool: true },
      { key: "fDok", label: "Posuv dokončování", unit: "mm/ot", type: "number", fromTool: true },
      { key: "VcHrub", label: "Řezná rychlost hrubování", unit: "m/min", type: "number", fromTool: true },
      { key: "VcDok", label: "Řezná rychlost dokončování", unit: "m/min", type: "number", fromTool: true },
      { key: "ap", label: "Hloubka řezu", unit: "mm", type: "number", fromTool: true },
    ],
  },
  {
    id: "podelneVnitrni",
    title: "Podélné soustružení (vnitřní)",
    shortTitle: "Podélné vnitřní",
    columns: [
      { key: "kontura", label: "Kontura", type: "text" },
      { key: "Dc", label: "Počáteční průměr", unit: "mm", type: "number", chainFrom: "Df" },
      { key: "Df", label: "Koncový průměr", unit: "mm", type: "number" },
      { key: "L", label: "Délka úseku", unit: "mm", type: "number" },
      { key: "fHrub", label: "Posuv hrubování", unit: "mm/ot", type: "number", fromTool: true },
      { key: "fDok", label: "Posuv dokončování", unit: "mm/ot", type: "number", fromTool: true },
      { key: "VcHrub", label: "Řezná rychlost hrubování", unit: "m/min", type: "number", fromTool: true },
      { key: "VcDok", label: "Řezná rychlost dokončování", unit: "m/min", type: "number", fromTool: true },
      { key: "ap", label: "Hloubka řezu", unit: "mm", type: "number", fromTool: true },
    ],
  },
  {
    id: "pricne",
    title: "Příčné soustružení",
    shortTitle: "Příčné",
    columns: [
      { key: "kontura", label: "Kontura", type: "text" },
      { key: "W", label: "Šířka čelní plochy", unit: "mm", type: "number" },
      { key: "D", label: "Průměr obrobku", unit: "mm", type: "number" },
      { key: "d", label: "Konečný průměr", unit: "mm", type: "number" },
      { key: "f", label: "Posuv", unit: "mm/ot", type: "number", fromTool: true },
      { key: "Vc", label: "Řezná rychlost", unit: "m/min", type: "number", fromTool: true },
      { key: "ap", label: "Hloubka řezu", unit: "mm", type: "number", fromTool: true },
    ],
  },
  {
    id: "vrtani",
    title: "Vrtání",
    shortTitle: "Vrtání",
    columns: [
      { key: "kontura", label: "Kontura", type: "text" },
      { key: "pocetDer", label: "Počet děr", type: "number" },
      { key: "D", label: "Průměr vrtáku", unit: "mm", type: "number", fromTool: true },
      { key: "L", label: "Hloubka vrtání", unit: "mm", type: "number" },
      { key: "f", label: "Posuv", unit: "mm/ot", type: "number", fromTool: true },
      { key: "Vc", label: "Řezná rychlost", unit: "m/min", type: "number", fromTool: true },
    ],
  },
  {
    id: "zapich",
    title: "Soustružení zápichu",
    shortTitle: "Zápich",
    columns: [
      { key: "kontura", label: "Kontura", type: "text" },
      { key: "D1", label: "Počáteční průměr D1", unit: "mm", type: "number" },
      { key: "D2", label: "Konečný průměr D2", unit: "mm", type: "number" },
      { key: "W", label: "Šířka zápichu W", unit: "mm", type: "number" },
      { key: "Fax", label: "Axiální posuv Fax", unit: "mm/ot", type: "number", fromTool: true },
      { key: "Vc", label: "Řezná rychlost", unit: "m/min", type: "number", fromTool: true },
      { key: "Wnuz", label: "Šířka nože", unit: "mm", type: "number", fromTool: true },
      { key: "Rap", label: "Max. radiální záběr", unit: "mm", type: "number", fromTool: true },
    ],
  },
  {
    id: "frezovaniDrazek",
    title: "Frézování pero drážek",
    shortTitle: "Frézování drážek",
    columns: [
      { key: "kontura", label: "Kontura", type: "text" },
      { key: "L", label: "Délka drážky", unit: "mm", type: "number" },
      { key: "W", label: "Šířka drážky", unit: "mm", type: "number" },
      { key: "D", label: "Hloubka drážky", unit: "mm", type: "number" },
      { key: "vf", label: "Posuv", unit: "mm/min", type: "number", fromTool: true },
      { key: "Dc", label: "Průměr frézy", unit: "mm", type: "number", fromTool: true },
      { key: "apMax", label: "Max. hloubka řezu", unit: "mm", type: "number", fromTool: true },
    ],
  },
  {
    id: "brouseniNaKulato",
    title: "Broušení na kulato",
    shortTitle: "Broušení",
    columns: [
      { key: "kontura", label: "Kontura", type: "text" },
      { key: "D1", label: "Počáteční průměr", unit: "mm", type: "number" },
      { key: "D2", label: "Konečný průměr", unit: "mm", type: "number" },
      { key: "L", label: "Délka broušené plochy", unit: "mm", type: "number" },
      { key: "No", label: "Otáčky obrobku", unit: "ot/min", type: "number" },
      { key: "Vc", label: "Řezná rychlost kotouče", unit: "m/s", type: "number", fromTool: true },
      { key: "Dc", label: "Průměr kotouče", unit: "mm", type: "number", fromTool: true },
      { key: "bs", label: "Šířka kotouče", unit: "mm", type: "number", fromTool: true },
      { key: "ap", label: "Hloubka úběru na vrstvu", unit: "mm", type: "number", fromTool: true },
      { key: "k", label: "Poměr k šířce kotouče", type: "number", fromTool: true },
    ],
  },
  {
    id: "celniZapichy",
    title: "Čelní zápichy",
    shortTitle: "Čelní zápichy",
    columns: [
      { key: "kontura", label: "Kontura", type: "text" },
      { key: "Dmax", label: "Max. průměr", unit: "mm", type: "number" },
      { key: "Dmin", label: "Min. průměr", unit: "mm", type: "number" },
      { key: "apZap", label: "Hloubka zápichu", unit: "mm", type: "number" },
      { key: "fZap", label: "Posuv", unit: "mm/ot", type: "number", fromTool: true },
      { key: "VcZap", label: "Řezná rychlost", unit: "m/min", type: "number", fromTool: true },
      { key: "Wnuz", label: "Šířka nože", unit: "mm", type: "number", fromTool: true },
      { key: "apMax", label: "Max. axiální záběr", unit: "mm", type: "number", fromTool: true },
    ],
  },
  {
    id: "pripravneCasy",
    title: "Přípravné časy",
    shortTitle: "Příprava",
    columns: [
      { key: "nazev", label: "Název", type: "text" },
      { key: "cas", label: "Čas", unit: "min", type: "number", fromTool: true },
      { key: "pocet", label: "Počet úkonů", type: "number" },
    ],
  },
];

/** Operace, které mají alespoň jedno pole odvoditelné z katalogu (nástroje pro
 *  obrábění, nebo u přípravných časů šablony úkonů). */
export const TOOL_OPERATIONS: OperationConfig[] = OPERATIONS.filter((op) =>
  op.columns.some((c) => c.fromTool)
);

/** Sloupce katalogu pro danou operaci: vlastní název položky katalogu (nástroje,
 *  nebo u přípravných časů šablony) + parametry, které operace označuje jako
 *  "fromTool". */
export function getToolColumns(op: OperationConfig): ColumnDef[] {
  const nazevLabel = op.id === "pripravneCasy" ? "Název šablony" : "Název nástroje";
  return [
    { key: "nazev", label: nazevLabel, type: "text" },
    ...op.columns.filter((c) => c.fromTool),
  ];
}

/** Obráběcí operace, u kterých má smysl říkat, jestli je stroj umí (na rozdíl od
 *  přípravných časů, které jsou obecné a nejsou vázané na konkrétní stroj). */
export const MACHINE_OPERATIONS: OperationConfig[] = OPERATIONS.filter((op) => op.id !== "pripravneCasy");

/** Zúží seznam operací na ty, které daný stroj umí - přípravné časy jsou vždy
 *  dostupné. Bez zadaného seznamu (žádný stroj vybraný/přiřazený) vrátí vše beze
 *  změny, ať appka funguje i bez zavedených strojů. */
export function filterOperationsForMachine<T extends OperationConfig>(pool: T[], operace: string[] | undefined): T[] {
  if (!operace) return pool;
  return pool.filter((op) => op.id === "pripravneCasy" || operace.includes(op.id));
}
