import { CalculationDraftRepository } from "@/domain/calculation-engine/repositories/calculation-draft-repository";
import { CalculationDraft } from "@/domain/calculation-engine/workflow/calculation-draft";
import { CalculationDraftRecord } from "@/infrastructure/persistence/indexeddb/records";
import { tpvGet, tpvGetAllByIndex, tpvPut, tpvDelete } from "@/infrastructure/persistence/indexeddb/tpv-db";
import { calculationDraftToRecord, calculationDraftFromRecord } from "./workflow-mappers";

/** IndexedDB implementace `CalculationDraftRepository` (AP-MCE-001 Fáze H §4/§27). */
export class IndexedDbCalculationDraftRepository implements CalculationDraftRepository {
  async getById(id: string, tenantId: string): Promise<CalculationDraft | null> {
    const record = await tpvGet<CalculationDraftRecord>("tpvCalculationDrafts", id);
    if (!record || record.tenantId !== tenantId) return null;
    return calculationDraftFromRecord(record);
  }

  async listByTenant(tenantId: string): Promise<CalculationDraft[]> {
    const records = await tpvGetAllByIndex<CalculationDraftRecord>("tpvCalculationDrafts", "tenantId", tenantId);
    return records.map(calculationDraftFromRecord).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async save(draft: CalculationDraft): Promise<void> {
    await tpvPut("tpvCalculationDrafts", calculationDraftToRecord(draft));
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const existing = await this.getById(id, tenantId);
    if (!existing) return;
    await tpvDelete("tpvCalculationDrafts", id);
  }
}
