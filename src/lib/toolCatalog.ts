// Obecný katalog nástrojů (per stroj) - viz AGENTS.md/plán "Přepracování architektury
// Strojů a Nástrojů". Nahrazuje dřívější katalog vedený zvlášť pro každou operaci
// (lib/useAllTools.ts, operations.ts getToolColumns) jedním plochým seznamem nástrojů
// na stroj s obecnými poli (Vc/f/ap/rozměry), napojeným na jednotlivé operace přes
// ColumnDef.toolField/toolRole (viz operations.ts).

import { ColumnDef, MACHINE_OPERATIONS, OPERATIONS, SelectOption } from "./operations";
import { Row } from "./results";

export type NastrojTyp = "hrubovaci" | "dokoncovaci" | "univerzalni";

export const NASTROJ_TYP_OPTIONS: SelectOption[] = [
  { value: "hrubovaci", label: "Hrubovací" },
  { value: "dokoncovaci", label: "Dokončovací" },
  { value: "univerzalni", label: "Univerzální" },
];

/** Sloupce obecného katalogu nástrojů stroje (záložka "Nástroje" u detailu stroje).
 *  Nezávislé na konkrétní operaci - jednotlivé operace si z nich přes toolField
 *  (viz operations.ts) berou jen to, co potřebují. */
export const TOOL_CATALOG_COLUMNS: ColumnDef[] = [
  { key: "nazev", label: "Název nástroje", type: "text" },
  { key: "typ", label: "Typ", type: "select", options: NASTROJ_TYP_OPTIONS, default: "univerzalni" },
  { key: "radius", label: "Radius špičky", unit: "mm", type: "number" },
  { key: "Vc", label: "Řezná rychlost (Vc)", unit: "m/min", type: "number" },
  { key: "f", label: "Posuv (f)", unit: "mm/ot", type: "number" },
  { key: "ap", label: "Hloubka řezu (ap)", unit: "mm", type: "number" },
  { key: "D", label: "Průměr nástroje", unit: "mm", type: "number" },
  { key: "sirka", label: "Šířka nástroje", unit: "mm", type: "number" },
  { key: "apMax", label: "Max. záběr na krok", unit: "mm", type: "number" },
  { key: "k", label: "Poměr k šířce kotouče", type: "number" },
  { key: "poznamka", label: "Poznámka", type: "text" },
];

export interface NastrojDruhDef {
  value: string;
  label: string;
  /** Klíče z TOOL_CATALOG_COLUMNS (mimo nazev/typ/poznamka, ty se nabízí vždy),
   *  které dává smysl u tohoto druhu nástroje vyplňovat. */
  fields: string[];
  /** Jestli u tohoto druhu dává smysl nabízet Typ (Hrubovací/Dokončovací/Univerzální) -
   *  reálně ho využívá jen výběr nástroje u podélného soustružení (dva výběry podle role,
   *  viz ColumnDef.toolRole v operations.ts), u ostatních druhů by jen matlo. */
  showTyp: boolean;
}

/** Druh nástroje řídí jen to, které pole se při zakládání nástroje nabídnou k vyplnění
 *  (viz AddToolModal) - není to samostatně ukládaný údaj, nástroj se pořád ukládá jako
 *  obecný řádek (TOOL_CATALOG_COLUMNS). Nový druh stačí přidat sem, nikam jinam. */
export const NASTROJ_DRUHY: NastrojDruhDef[] = [
  { value: "soustruznickyNuz", label: "Soustružnický nůž", fields: ["radius", "Vc", "f", "ap"], showTyp: true },
  { value: "zapichovaciNuz", label: "Zapichovací/upichovací nůž", fields: ["Vc", "f", "sirka", "apMax"], showTyp: false },
  { value: "vrtak", label: "Vrták", fields: ["Vc", "f", "D"], showTyp: false },
  { value: "freza", label: "Fréza", fields: ["f", "D", "apMax"], showTyp: false },
  { value: "brusnyKotouc", label: "Brusný kotouč", fields: ["Vc", "ap", "D", "sirka", "k"], showTyp: false },
  {
    value: "obecny",
    label: "Univerzální / jiný",
    fields: TOOL_CATALOG_COLUMNS.filter((c) => !["nazev", "typ", "poznamka"].includes(c.key)).map((c) => c.key),
    showTyp: true,
  },
];

/** Popisky kategorií operací pro odvození typu stroje - viz OperationConfig.category
 *  v operations.ts. Přidání nové kategorie (a případně kombinované COMBO_LABELS níže)
 *  stačí k rozšíření bez zásahu do zbytku appky. */
const MACHINE_CATEGORIES: { id: "soustruzeni" | "frezovani" | "brouseni"; label: string }[] = [
  { id: "soustruzeni", label: "Soustruh" },
  { id: "frezovani", label: "Frézka" },
  { id: "brouseni", label: "Bruska" },
];

const COMBO_LABELS: Record<string, string> = {
  "frezovani+soustruzeni": "Soustružnické centrum",
};

/** Typ stroje se nikde neukládá - odvozuje se za běhu z podporovaných operací
 *  (Machine.operace). Vrtání záměrně nemá kategorii (běžné na soustruhu i frézce),
 *  takže samo o sobě typ neurčuje. */
export function deriveMachineType(operace: string[] | undefined): string {
  if (!operace || operace.length === 0) return "Stroj";
  const categories = new Set(
    MACHINE_OPERATIONS.filter((op) => op.category && operace.includes(op.id)).map((op) => op.category!)
  );
  if (categories.size === 0) return "Stroj";
  if (categories.size === 1) {
    const id = [...categories][0];
    return MACHINE_CATEGORIES.find((c) => c.id === id)?.label ?? "Stroj";
  }
  const comboKey = [...categories].sort().join("+");
  if (COMBO_LABELS[comboKey]) return COMBO_LABELS[comboKey];
  return [...categories].map((id) => MACHINE_CATEGORIES.find((c) => c.id === id)?.label ?? id).join(" + ");
}

/** Vrátí, co se má z vybraného nástroje/šablony přepsat do konkrétních polí kontury -
 *  podle ColumnDef.toolField (ne podle stejného klíče, nástroj má jiný tvar). */
export function applyToolToRow(toolRow: Row, columns: ColumnDef[]): Record<string, string | number | null> {
  const patch: Record<string, string | number | null> = {};
  for (const c of columns) {
    if (!c.fromTool || !c.toolField) continue;
    const v = toolRow[c.toolField];
    if (v !== null && v !== undefined && v !== "") patch[c.key] = v;
  }
  return patch;
}

const emptyOrMissing = (v: Row[string]) => v === null || v === undefined || v === "";

/** Převede staré per-operaci katalogy nástrojů ("toolRows", viz lib/db.ts) na nový tvar:
 *  jeden plochý seznam nástrojů na stroj + zvlášť šablony přípravných časů. Používá se
 *  jak při jednorázové migraci po startu appky (migrateLegacy.ts), tak při obnově staré
 *  zálohy (backup.ts). Beze ztráty dat: sloupce, pro které nová obecná definice nástroje
 *  nemá odpovídající pole, do nového tvaru nemapujeme jen u toho, co appka nikdy
 *  neukládala (výrobce/držák/ISO/sklad...) - takové sloupce v datech nejsou.
 *  Stejnojmenné nástroje z různých operací se při sloučení do jednoho seznamu odliší
 *  suffixem se zdrojovou operací, ať se navzájem nepřepíšou. */
export function convertLegacyToolRows(
  records: { strojId: string; opId: string; rows: Row[] }[]
): { tools: Record<string, Row[]>; setupTemplates: Record<string, Row[]> } {
  const tools: Record<string, Row[]> = {};
  const setupTemplates: Record<string, Row[]> = {};

  for (const rec of records) {
    if (rec.rows.length === 0) continue;
    const op = OPERATIONS.find((o) => o.id === rec.opId);
    if (!op) continue;

    if (op.id === "pripravneCasy") {
      const target = (setupTemplates[rec.strojId] ??= []);
      target.push(...rec.rows);
      continue;
    }

    const target = (tools[rec.strojId] ??= []);
    const toolCols = op.columns.filter((c) => c.fromTool);
    const hasRoles = toolCols.some((c) => c.toolRole);

    for (const row of rec.rows) {
      const nazev = String(row.nazev ?? "").trim();

      if (!hasRoles) {
        const tool: Row = {
          nazev: nazev ? `${nazev} (${op.shortTitle})` : op.shortTitle,
          typ: "univerzalni",
          radius: null,
          poznamka: null,
        };
        for (const c of toolCols) {
          if (c.toolField) tool[c.toolField] = row[c.key] ?? null;
        }
        target.push(tool);
        continue;
      }

      // Operace se dvěma souběžnými sadami řezných hodnot (hrubování + dokončování,
      // viz podélné soustružení) - starý řádek se rozpadne na dva nástroje podle role.
      const hrubCols = toolCols.filter((c) => c.toolRole !== "dok");
      const dokCols = toolCols.filter((c) => c.toolRole === "dok");
      const hasDok = dokCols.some((c) => !emptyOrMissing(row[c.key]));

      const hrubTool: Row = {
        nazev: nazev ? `${nazev} (${op.shortTitle}, hrubování)` : `${op.shortTitle} (hrubování)`,
        typ: "hrubovaci",
        radius: null,
        poznamka: null,
      };
      for (const c of hrubCols) {
        if (c.toolField) hrubTool[c.toolField] = row[c.key] ?? null;
      }
      target.push(hrubTool);

      if (hasDok) {
        const dokTool: Row = {
          nazev: nazev ? `${nazev} (${op.shortTitle}, dokončování)` : `${op.shortTitle} (dokončování)`,
          typ: "dokoncovaci",
          radius: null,
          poznamka: null,
        };
        for (const c of dokCols) {
          if (c.toolField) dokTool[c.toolField] = row[c.key] ?? null;
        }
        target.push(dokTool);
      }
    }
  }

  return { tools, setupTemplates };
}
