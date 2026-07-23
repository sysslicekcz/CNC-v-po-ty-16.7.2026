import { QuoteCalculationLink } from "../workflow/quote-calculation-link";

/** Port pro `QuoteCalculationLink` (AP-MCE-001 Fáze H §19/§36). */
export interface QuoteCalculationLinkRepository {
  getById(id: string, tenantId: string): Promise<QuoteCalculationLink | null>;
  listByQuoteItem(quoteItemId: string, tenantId: string): Promise<QuoteCalculationLink[]>;
  save(link: QuoteCalculationLink): Promise<void>;
}
