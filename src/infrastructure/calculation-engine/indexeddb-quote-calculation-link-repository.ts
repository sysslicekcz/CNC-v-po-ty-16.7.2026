import { QuoteCalculationLinkRepository } from "@/domain/calculation-engine/repositories/quote-calculation-link-repository";
import { QuoteCalculationLink } from "@/domain/calculation-engine/workflow/quote-calculation-link";
import { QuoteCalculationLinkRecord } from "@/infrastructure/persistence/indexeddb/records";
import { tpvGet, tpvGetAllByIndex, tpvPut } from "@/infrastructure/persistence/indexeddb/tpv-db";
import { quoteCalculationLinkToRecord, quoteCalculationLinkFromRecord } from "./workflow-mappers";

/** IndexedDB implementace `QuoteCalculationLinkRepository` (AP-MCE-001 Fáze H §19). */
export class IndexedDbQuoteCalculationLinkRepository implements QuoteCalculationLinkRepository {
  async getById(id: string, tenantId: string): Promise<QuoteCalculationLink | null> {
    const record = await tpvGet<QuoteCalculationLinkRecord>("tpvQuoteCalculationLinks", id);
    if (!record || record.tenantId !== tenantId) return null;
    return quoteCalculationLinkFromRecord(record);
  }

  async listByQuoteItem(quoteItemId: string, tenantId: string): Promise<QuoteCalculationLink[]> {
    const records = await tpvGetAllByIndex<QuoteCalculationLinkRecord>("tpvQuoteCalculationLinks", "quoteItemId", quoteItemId);
    return records.filter((r) => r.tenantId === tenantId).map(quoteCalculationLinkFromRecord);
  }

  async save(link: QuoteCalculationLink): Promise<void> {
    await tpvPut("tpvQuoteCalculationLinks", quoteCalculationLinkToRecord(link));
  }
}
