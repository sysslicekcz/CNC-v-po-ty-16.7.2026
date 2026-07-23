import { StrategyFormSchema, GenericCalculationDraft } from "./form-field-types";
import { TURNING_FORM_SCHEMA } from "./schemas/turning-schema";
import { MILLING_FORM_SCHEMA } from "./schemas/milling-schema";
import { GRINDING_CYLINDRICAL_FORM_SCHEMA, GRINDING_SURFACE_FORM_SCHEMA } from "./schemas/grinding-schema";
import { MANUAL_FORM_SCHEMA } from "./schemas/manual-schema";
import { INSPECTION_FORM_SCHEMA } from "./schemas/inspection-schema";
import {
  buildTurningInput,
  buildMillingInput,
  buildGrindingInput,
  buildManualInput,
  buildInspectionInput,
} from "@/application/calculation-engine/workflow/forms/form-input-builders";
import { PreviewCalculationInput } from "@/application/calculation-engine/workflow/use-cases/preview-calculation-use-case";

export interface CalculationFormRegistryEntry {
  schema: StrategyFormSchema;
  buildInput: (draft: GenericCalculationDraft, schema: StrategyFormSchema) => PreviewCalculationInput;
}

/**
 * `CalculationFormRegistry` (AP-MCE-001 Fáze H §5) - JEDNO místo, které váže
 * klíč formuláře (zvolený ve druhém kroku průvodce) na jeho deklarativní
 * schéma (`StrategyFormSchema`) + mapovací funkci na doménový vstup. Přidání
 * nové strategie znamená přidat nový `schemas/*.ts` + `builders.ts` funkci +
 * JEDEN zápis sem - beze změny generického rendereru (`GenericFeatureForm`)
 * ani ostatních záznamů (§5 "rozšiřitelný bez změny ostatních formulářů").
 *
 * `grinding_cylindrical`/`grinding_surface` jsou DVA registrové záznamy nad
 * STEJNOU doménovou kategorií (`grinding`) - `GrindingCalculationStrategy`
 * (Fáze E) sama dispatchuje podle `features[].subtype` na válcovou/rovinnou
 * rodinu, tady jde jen o DVĚ různé, užší nabídky podtypů/polí pro uživatele,
 * ne o dvě různé domain kategorie.
 */
export const CALCULATION_FORM_REGISTRY: Record<string, CalculationFormRegistryEntry> = {
  turning: { schema: TURNING_FORM_SCHEMA, buildInput: buildTurningInput },
  milling: { schema: MILLING_FORM_SCHEMA, buildInput: buildMillingInput },
  grinding_cylindrical: { schema: GRINDING_CYLINDRICAL_FORM_SCHEMA, buildInput: buildGrindingInput },
  grinding_surface: { schema: GRINDING_SURFACE_FORM_SCHEMA, buildInput: buildGrindingInput },
  manual: { schema: MANUAL_FORM_SCHEMA, buildInput: buildManualInput },
  inspection: { schema: INSPECTION_FORM_SCHEMA, buildInput: buildInspectionInput },
};

export type CalculationFormKey = keyof typeof CALCULATION_FORM_REGISTRY;

export const CALCULATION_FORM_OPTIONS: { key: CalculationFormKey; label: string }[] = Object.entries(CALCULATION_FORM_REGISTRY).map(([key, entry]) => ({
  key: key as CalculationFormKey,
  label: entry.schema.label,
}));
