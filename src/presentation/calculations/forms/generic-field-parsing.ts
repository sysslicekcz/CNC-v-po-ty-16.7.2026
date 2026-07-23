import { FieldGroup, FieldSchema, GenericFeatureDraft } from "./form-field-types";

/** `parseGroupFields`/`parseOperationFields` žijí v Application vrstvě
 *  (`@/application/calculation-engine/workflow/forms/form-field-parsing`) -
 *  volá je jen `form-input-builders.ts` tamtéž, který kvůli tomu musí
 *  importovat doménové vstupní typy přímo (`TurningCalculationInput`
 *  apod.), a to smí jen domain/application, ne presentation (viz
 *  architektonické testy Fáze C-F). Tenhle soubor si nechává jen ryze
 *  prezentační pomůcky (klíčování polí ve formuláři, práce s `GenericFeature
 *  Draft[]`). */

export function fieldKey(group: FieldGroup, key: string): string {
  return `${group}.${key}`;
}

export function undefinedIfEmpty<T extends object>(obj: T): T | undefined {
  return Object.keys(obj).length > 0 ? obj : undefined;
}

export function isFeatureApplicable(field: FieldSchema, subtype: string): boolean {
  return !field.appliesToSubtypes || field.appliesToSubtypes.includes(subtype);
}

export function nextSequence(features: readonly GenericFeatureDraft[]): number {
  return features.length;
}
