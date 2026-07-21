import { ManualTimeStandardRepository } from "@/domain/calculation-engine/repositories/manual-time-standard-repository";
import { ManualTimeStandard } from "@/domain/calculation-engine/manual/manual-time-standard";
import type { ManualOperationSubtype } from "@/domain/calculation-engine/manual/manual-operation-subtype";
import { ManualTimeStandardRecord } from "@/infrastructure/persistence/indexeddb/records";
import { tpvGet, tpvGetAllByIndex, tpvPut } from "@/infrastructure/persistence/indexeddb/tpv-db";
import { manualTimeStandardToRecord, manualTimeStandardFromRecord } from "./manual-inspection-mappers";

const SYSTEM_TENANT_KEY = "system";

/**
 * IndexedDB implementace `ManualTimeStandardRepository` (AP-MCE-001 Fáze F
 * §5). Systémové (globální) standardy nemají `tenantId` v doméně
 * (`ManualTimeStandard.tenantId === undefined`), ale IndexedDB index
 * potřebuje konkrétní hodnotu klíče pro dotazování - `SYSTEM_TENANT_KEY`
 * ("system") je INTERNÍ detail perzistence, nikdy neuniká mimo tenhle
 * soubor (mapper vrací `tenantId: undefined` zpátky do domény, viz
 * `manualTimeStandardFromRecord`... pozor, mapper čte přímo `record.tenantId`,
 * proto se tady systémové řádky ukládají BEZ `tenantId` pole a hledají přes
 * zvláštní index `tenantId_isSystem`).
 */
export class IndexedDbManualTimeStandardRepository implements ManualTimeStandardRepository {
  async getById(id: string, tenantId: string): Promise<ManualTimeStandard | null> {
    const record = await tpvGet<ManualTimeStandardRecord>("tpvManualTimeStandards", id);
    if (!record) return null;
    const isSystemRecord = record.tenantId === undefined || record.tenantId === SYSTEM_TENANT_KEY;
    if (!isSystemRecord && record.tenantId !== tenantId) return null;
    return manualTimeStandardFromRecord({ ...record, tenantId: isSystemRecord ? undefined : record.tenantId });
  }

  async findCandidates(operationSubtype: ManualOperationSubtype, tenantId: string): Promise<ManualTimeStandard[]> {
    const [tenantRecords, systemRecords] = await Promise.all([
      tpvGetAllByIndex<ManualTimeStandardRecord>("tpvManualTimeStandards", "tenantId", tenantId),
      tpvGetAllByIndex<ManualTimeStandardRecord>("tpvManualTimeStandards", "tenantId", SYSTEM_TENANT_KEY),
    ]);
    return [...tenantRecords, ...systemRecords]
      .filter((r) => r.operationSubtype === operationSubtype)
      .map((r) => manualTimeStandardFromRecord({ ...r, tenantId: r.tenantId === SYSTEM_TENANT_KEY ? undefined : r.tenantId }));
  }

  async listByTenant(tenantId: string): Promise<ManualTimeStandard[]> {
    const records = await tpvGetAllByIndex<ManualTimeStandardRecord>("tpvManualTimeStandards", "tenantId", tenantId);
    return records.map(manualTimeStandardFromRecord);
  }

  async save(standard: ManualTimeStandard): Promise<void> {
    const record = manualTimeStandardToRecord(standard);
    await tpvPut("tpvManualTimeStandards", { ...record, tenantId: record.tenantId ?? SYSTEM_TENANT_KEY });
  }

  async archive(id: string, tenantId: string, archivedAt: string): Promise<void> {
    const existing = await this.getById(id, tenantId);
    if (!existing) return;
    await this.save(
      ManualTimeStandard.create({
        ...existing.toPlainObject(),
        archivedAt,
        updatedAt: archivedAt,
        recordVersion: existing.recordVersion + 1,
      } as Parameters<typeof ManualTimeStandard.create>[0])
    );
  }
}
