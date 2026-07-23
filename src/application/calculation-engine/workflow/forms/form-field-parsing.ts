import { FormFieldContract, FormFieldGroup } from "./form-field-contract";

/** Sestaví plochý objekt jedné skupiny polí (geometrie/řezné podmínky/pass
 *  strategie/dressing) z rozepsaného `fields` (AP-MCE-001 Fáze H §5) - jen
 *  pole APLIKOVATELNÁ pro daný `subtype` (§5 "dynamické formuláře podle
 *  strategie"), prázdné/nevyplněné textové hodnoty se přeskočí (zůstanou
 *  `undefined` v doménovém vstupu, ne prázdný řetězec). */
export function parseGroupFields(
  fields: Readonly<Record<string, string | boolean>>,
  contracts: readonly FormFieldContract[],
  group: FormFieldGroup,
  subtype: string
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const f of contracts) {
    if (f.group !== group) continue;
    if (f.appliesToSubtypes && !f.appliesToSubtypes.includes(subtype)) continue;
    const raw = fields[`${f.group}.${f.key}`];
    if (raw === undefined || raw === "") continue;
    if (f.type === "number") {
      const n = Number(raw);
      if (Number.isFinite(n)) result[f.key] = n;
    } else if (f.type === "checkbox") {
      result[f.key] = Boolean(raw);
    } else {
      result[f.key] = raw;
    }
  }
  return result;
}

/** Stejné jako `parseGroupFields`, jen bez `subtype` filtru - použití pro
 *  pole na úrovni CELÉ operace, kde žádný podtyp featuru neexistuje. */
export function parseOperationFields(fields: Readonly<Record<string, string | boolean>>, contracts: readonly FormFieldContract[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const f of contracts) {
    const raw = fields[`${f.group}.${f.key}`];
    if (raw === undefined || raw === "") continue;
    if (f.type === "number") {
      const n = Number(raw);
      if (Number.isFinite(n)) result[f.key] = n;
    } else if (f.type === "checkbox") {
      result[f.key] = Boolean(raw);
    } else {
      result[f.key] = raw;
    }
  }
  return result;
}

export function undefinedIfEmpty<T extends object>(obj: T): T | undefined {
  return Object.keys(obj).length > 0 ? obj : undefined;
}
