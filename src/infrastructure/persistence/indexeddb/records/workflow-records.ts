import type { CalculationDraftProps } from "@/domain/calculation-engine/workflow/calculation-draft";
import type { TechnologyOperationCalculationLinkProps } from "@/domain/calculation-engine/workflow/technology-operation-calculation-link";
import type { QuoteCalculationLinkProps } from "@/domain/calculation-engine/workflow/quote-calculation-link";

/**
 * Ploché IndexedDB záznamy pro Fázi H (AP-MCE-001 §36) - stejný vzor jako
 * `calibration-records.ts` (Fáze G): všechny tři entity mají props přímo
 * serializovatelné, `Record` tvar je proto totožný s `...Props`.
 */
export type CalculationDraftRecord = CalculationDraftProps;
export type TechnologyOperationCalculationLinkRecord = TechnologyOperationCalculationLinkProps;
export type QuoteCalculationLinkRecord = QuoteCalculationLinkProps;
