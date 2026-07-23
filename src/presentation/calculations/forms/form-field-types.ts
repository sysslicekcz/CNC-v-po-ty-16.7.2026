import type { OperationCategory } from "@/application/calculation-engine/dto/calculation-engine-ui-types";
import type { FormFieldContract, FormFieldGroup } from "@/application/calculation-engine/workflow/forms/form-field-contract";

export interface SelectOption {
  value: string;
  label: string;
}

/** Alias zachovaný kvůli existujícím schématům - stejný výčet jako
 *  Application `FormFieldGroup` (viz `FieldSchema` níž pro zdůvodnění, proč
 *  je rozdělený mezi vrstvy). */
export type FieldGroup = FormFieldGroup;

/**
 * `FieldSchema` rozšiřuje Application `FormFieldContract` o UI popisky
 * (`label`/`options` s textem) - STRUKTURÁLNÍ část (key/group/type/unit/
 * appliesToSubtypes), kterou potřebuje `form-input-builders.ts` k sestavení
 * doménového vstupu, žije v Application (viz `form-field-contract.ts`
 * komentář), protože Application (na rozdíl od presentation) smí importovat
 * doménové vstupní typy přímo. Presentation na Application smí záviset
 * (opačně ne), proto `FieldSchema` odsud `FormFieldContract` normálně
 * importuje.
 */
export interface FieldSchema extends FormFieldContract {
  label: string;
  options?: SelectOption[];
}

/**
 * `StrategyFormSchema` (AP-MCE-001 Fáze H §5 "Form registry") - DEKLARATIVNÍ
 * popis jednoho formuláře strategie. `GenericFeatureForm` (stejná komponenta
 * pro všech 6 registrovaných formulářů) ho jen VYKRESLÍ a naplní - přidání
 * nové strategie (budoucí Fáze) znamená přidat NOVÝ soubor se schématem +
 * jeden zápis do registru, beze změny existujících schémat nebo generického
 * rendereru (§5 "rozšiřitelný bez změny ostatních formulářů").
 */
export interface StrategyFormSchema {
  key: string;
  label: string;
  category: OperationCategory;
  subtypeOptions: SelectOption[];
  machiningModeOptions?: SelectOption[];
  measurementRequirementOptions?: SelectOption[];
  /** Pole na úrovni JEDNOHO featuru (geometrie/řezné podmínky/pass strategie/
   *  dressing strategie/přímé vlastnosti featuru). */
  featureFields: FieldSchema[];
  /** Pole na úrovni CELÉ operace (mimo quantity/materialId/machineId/toolId/
   *  workstationId, které řeší generický formulář sám - společná pro
   *  všechny kategorie, §4 "Společné vstupy"). */
  operationFields: FieldSchema[];
  /** `true`, pokud operace featury vůbec nevyžaduje (ruční operace smí mít
   *  jen `baseUnitTimeMin` bez featurů, §9). */
  featuresOptional?: boolean;
}

export interface GenericFeatureDraft {
  id: string;
  subtype: string;
  machiningMode?: string;
  measurementRequirement?: string;
  /** Klíč `"${group}.${key}"` -> textová/boolean hodnota tak, jak ji uživatel
   *  zadal (parsování na number/boolean dělá až `buildDomainInput`). */
  fields: Record<string, string | boolean>;
  notes?: string;
}

export interface GenericCalculationDraft {
  operationTypeId: string;
  quantity: string;
  materialId: string;
  machineId: string;
  toolId: string;
  workstationId: string;
  operationFields: Record<string, string | boolean>;
  features: GenericFeatureDraft[];
  /** Ruční operace bez featurů (§9 "baseUnitTimeMin") - `features` zůstává
   *  prázdné, tenhle text nese jednotkový čas přímo. */
  baseUnitTimeMin?: string;
}

export function emptyGenericDraft(operationTypeId = ""): GenericCalculationDraft {
  return {
    operationTypeId,
    quantity: "1",
    materialId: "",
    machineId: "",
    toolId: "",
    workstationId: "",
    operationFields: {},
    features: [],
  };
}

export function newFeatureDraft(subtype: string, sequence: number): GenericFeatureDraft {
  return { id: `f-${Date.now()}-${sequence}-${Math.round(Math.random() * 1e6)}`, subtype, fields: {} };
}

/** Vytváří nové `id` mimo tělo komponenty (`Date.now`/`Math.random` jsou
 *  nečisté funkce - React compiler lint hlásí i jejich volání uvnitř event
 *  handleru definovaného v těle komponenty, viz `GenericFeatureForm.
 *  duplicateFeature`). */
export function duplicateFeatureDraft(source: GenericFeatureDraft): GenericFeatureDraft {
  return { ...source, id: `${source.id}-copy-${Date.now()}-${Math.round(Math.random() * 1e6)}`, fields: { ...source.fields } };
}
