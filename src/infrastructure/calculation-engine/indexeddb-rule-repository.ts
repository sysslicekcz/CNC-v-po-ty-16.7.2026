import { RuleRepository } from "@/domain/calculation-engine/repositories/rule-repository";
import { RuleVersion } from "@/domain/calculation-engine/rules/rule-version";
import { RuleVersionRecord } from "@/infrastructure/persistence/indexeddb/records";
import { tpvGet, tpvGetAllByIndex, tpvPut } from "@/infrastructure/persistence/indexeddb/tpv-db";
import { ruleVersionToRecord, ruleVersionFromRecord } from "./mappers";

/** IndexedDB implementace `RuleRepository` (AP-MCE-001, Fáze A) - viz komentář
 *  u `IndexedDbCalculationRepository` pro zdůvodnění umístění/sdílené DB. */
export class IndexedDbRuleRepository implements RuleRepository {
  async findActiveVersion(tenantId: string): Promise<RuleVersion | null> {
    const records = await tpvGetAllByIndex<RuleVersionRecord>("tpvRuleVersions", "tenantId", tenantId);
    const match = records.find((r) => r.status === "active");
    return match ? ruleVersionFromRecord(match) : null;
  }

  async findById(id: string, tenantId: string): Promise<RuleVersion | null> {
    const record = await tpvGet<RuleVersionRecord>("tpvRuleVersions", id);
    if (!record || record.tenantId !== tenantId) return null;
    return ruleVersionFromRecord(record);
  }

  async save(ruleVersion: RuleVersion): Promise<void> {
    await tpvPut("tpvRuleVersions", ruleVersionToRecord(ruleVersion));
  }
}
