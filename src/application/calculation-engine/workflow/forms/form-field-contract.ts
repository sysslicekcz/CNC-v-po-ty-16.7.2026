/**
 * `FormFieldContract` (AP-MCE-001 Fáze H §5) - STRUKTURÁLNÍ (bez popisků pro
 * uživatele) část jednoho pole `CalculationFormRegistry` schématu: kam v
 * doménovém vstupu patří (`group`), jak se má naparsovat (`type`) a pro
 * které podtypy featuru platí (`appliesToSubtypes`). Žije v Application
 * vrstvě záměrně - `form-input-builders.ts` v tomhle souboru importuje
 * doménové vstupní typy (`TurningCalculationInput` apod.), což smí jen
 * domain/application (architektonické testy Fáze C-F to vynucují). UI popisek
 * (`label`, `options` s textem) přidává až prezentační `FieldSchema`
 * (`presentation/calculations/forms/form-field-types.ts`), který
 * `FormFieldContract` rozšiřuje - ne obráceně.
 */
export type FormFieldGroup = "feature" | "geometry" | "cuttingConditionOverride" | "passStrategy" | "dressingStrategy";

export interface FormFieldContract {
  key: string;
  group: FormFieldGroup;
  type: "number" | "text" | "select" | "checkbox";
  unit?: string;
  appliesToSubtypes?: string[];
}

/** Plochý, čistě datový návrh JEDNOHO technologického úseku - stejný tvar
 *  jako prezentační `GenericFeatureDraft`, ale bez závislosti na presentation
 *  vrstvě (Application na ni záviset nesmí). Presentation typ je s tímhle
 *  strukturálně shodný, proto ho lze předat bez explicitního přetypování. */
export interface GenericFeatureDraftData {
  id: string;
  subtype: string;
  machiningMode?: string;
  measurementRequirement?: string;
  fields: Record<string, string | boolean>;
  notes?: string;
}

/** Plochý, čistě datový návrh CELÉHO konceptu výpočtu - viz
 *  `GenericFeatureDraftData` výše pro zdůvodnění, proč je oddělený od
 *  prezentačního `GenericCalculationDraft`. */
export interface GenericCalculationDraftData {
  operationTypeId: string;
  quantity: string;
  materialId: string;
  machineId: string;
  toolId: string;
  workstationId: string;
  operationFields: Record<string, string | boolean>;
  features: GenericFeatureDraftData[];
  baseUnitTimeMin?: string;
}

/** Jen ta část `StrategyFormSchema`, kterou stavitelé vstupu (`form-input-
 *  builders.ts`) skutečně potřebují - žádné popisky pro uživatele. */
export interface StrategyFormFieldContracts {
  featureFields: FormFieldContract[];
  operationFields: FormFieldContract[];
}
