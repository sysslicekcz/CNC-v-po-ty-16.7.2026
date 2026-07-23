import { CalculationDraft } from "@/domain/calculation-engine/workflow/calculation-draft";
import { TechnologyOperationCalculationLink } from "@/domain/calculation-engine/workflow/technology-operation-calculation-link";
import { QuoteCalculationLink } from "@/domain/calculation-engine/workflow/quote-calculation-link";
import { CalculationDraftRecord, TechnologyOperationCalculationLinkRecord, QuoteCalculationLinkRecord } from "@/infrastructure/persistence/indexeddb/records";

/**
 * Mapování doména <-> IndexedDB záznam pro Fázi H (AP-MCE-001 §36) - stejný
 * vzor jako `calibration-mappers.ts` (Fáze G): entity mají `toPlainObject()`
 * tvar totožný s konstruktorovými `Props`, mapper je jen `create()`/
 * `toPlainObject()` průchod.
 */
export const calculationDraftToRecord = (entity: CalculationDraft): CalculationDraftRecord => entity.toPlainObject() as unknown as CalculationDraftRecord;
export const calculationDraftFromRecord = (record: CalculationDraftRecord): CalculationDraft => CalculationDraft.create(record);

export const technologyOperationCalculationLinkToRecord = (entity: TechnologyOperationCalculationLink): TechnologyOperationCalculationLinkRecord =>
  entity.toPlainObject() as unknown as TechnologyOperationCalculationLinkRecord;
export const technologyOperationCalculationLinkFromRecord = (record: TechnologyOperationCalculationLinkRecord): TechnologyOperationCalculationLink =>
  TechnologyOperationCalculationLink.create(record);

export const quoteCalculationLinkToRecord = (entity: QuoteCalculationLink): QuoteCalculationLinkRecord => entity.toPlainObject() as unknown as QuoteCalculationLinkRecord;
export const quoteCalculationLinkFromRecord = (record: QuoteCalculationLinkRecord): QuoteCalculationLink => QuoteCalculationLink.create(record);
