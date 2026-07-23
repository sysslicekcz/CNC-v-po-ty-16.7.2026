import { CalculationDraft } from "../workflow/calculation-draft";

/** Port pro `CalculationDraft` (AP-MCE-001 Fáze H §4/§27/§36). */
export interface CalculationDraftRepository {
  getById(id: string, tenantId: string): Promise<CalculationDraft | null>;
  listByTenant(tenantId: string): Promise<CalculationDraft[]>;
  save(draft: CalculationDraft): Promise<void>;
  delete(id: string, tenantId: string): Promise<void>;
}
