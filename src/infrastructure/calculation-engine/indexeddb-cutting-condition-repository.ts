import {
  CuttingConditionRepository,
  CuttingConditionCandidateCriteria,
} from "@/domain/calculation-engine/repositories/cutting-condition-repository";
import { CuttingCondition } from "@/domain/calculation-engine/cutting-conditions/cutting-condition";
import type { OperationCategory } from "@/domain/calculation-engine/enums/operation-category";
import { ExternalReferenceRepository } from "@/domain/repositories/external-reference-repository";
import { CuttingConditionRecord } from "@/infrastructure/persistence/indexeddb/records";
import { tpvGet, tpvGetAllByIndex, tpvPut } from "@/infrastructure/persistence/indexeddb/tpv-db";
import { cuttingConditionToRecord, cuttingConditionFromRecord } from "./profile-mappers";

/**
 * IndexedDB implementace `CuttingConditionRepository` (AP-MCE-001 Fáze B §8) -
 * viz `IndexedDbMaterialProfileRepository` pro plné zdůvodnění vzoru.
 * `findCandidates`/`findSystemDefault` filtrují v JS nad `tenantId` indexem
 * (stejná konvence jako zbytek appky) - `CuttingCondition.matches()` (Domain)
 * dělá skutečné porovnání kritérií, repozitář jen dodá kandidáty pro daného
 * tenanta.
 */
export class IndexedDbCuttingConditionRepository implements CuttingConditionRepository {
  constructor(private readonly externalReferenceRepository: ExternalReferenceRepository) {}

  async getById(id: string, tenantId: string): Promise<CuttingCondition | null> {
    const record = await tpvGet<CuttingConditionRecord>("tpvCuttingConditions", id);
    if (!record || record.tenantId !== tenantId) return null;
    return cuttingConditionFromRecord(record);
  }

  /**
   * `CuttingCondition` nemá vlastní `ExternalReferenceEntityType` (§9) -
   * na rozdíl od materiálu/stroje/nástroje to NENÍ ERP synchronizovaná
   * kmenová data, ale odvozený read-model nad existující
   * `ToolMachineCondition` (ta svou vlastní ERP referenci řeší, pokud ji
   * potřebuje). Mapování externího ID na konkrétní `CuttingCondition`
   * proto nemá přirozený cíl - metoda existuje kvůli jednotnému tvaru
   * portu (§7), ale vždy vrátí `null`.
   */
  async findByExternalReference(): Promise<CuttingCondition | null> {
    return null;
  }

  async listByTenant(tenantId: string): Promise<CuttingCondition[]> {
    const records = await tpvGetAllByIndex<CuttingConditionRecord>("tpvCuttingConditions", "tenantId", tenantId);
    return records.map(cuttingConditionFromRecord);
  }

  async save(condition: CuttingCondition): Promise<void> {
    await tpvPut("tpvCuttingConditions", cuttingConditionToRecord(condition));
  }

  async archive(id: string, tenantId: string, archivedAt: string): Promise<void> {
    const existing = await this.getById(id, tenantId);
    if (!existing) return;
    await this.save(CuttingCondition.create({ ...conditionToProps(existing), validTo: archivedAt }));
  }

  async getVersion(id: string, tenantId: string): Promise<string | null> {
    const existing = await this.getById(id, tenantId);
    return existing ? existing.ruleVersion : null;
  }

  async findCandidates(criteria: CuttingConditionCandidateCriteria): Promise<CuttingCondition[]> {
    const records = await tpvGetAllByIndex<CuttingConditionRecord>("tpvCuttingConditions", "tenantId", criteria.tenantId);
    return records.map(cuttingConditionFromRecord).filter((condition) =>
      condition.matches({
        toolProfileId: criteria.toolProfileId,
        machineProfileId: criteria.machineProfileId,
        materialProfileId: criteria.materialProfileId,
        operationCategory: criteria.operationCategory,
      })
    );
  }

  async findSystemDefault(tenantId: string, operationCategory: OperationCategory): Promise<CuttingCondition | null> {
    const records = await tpvGetAllByIndex<CuttingConditionRecord>("tpvCuttingConditions", "tenantId", tenantId);
    const match = records.find((r) => r.source === "system_default" && r.operationCategory === operationCategory);
    return match ? cuttingConditionFromRecord(match) : null;
  }
}

/** `CuttingCondition` nemá `archive()`/vlastní "with-changes" metodu (na
 *  rozdíl od profilů) - je to read-model bez korekcí, "archivace" tu znamená
 *  jen uzavřít platnost (`validTo`), ne označit celý záznam jako smazaný.
 *  Malá pomocná funkce místo duplikace všech polí na místě volání. */
function conditionToProps(condition: CuttingCondition) {
  return {
    id: condition.id,
    tenantId: condition.tenantId,
    materialProfileId: condition.materialProfileId,
    machineProfileId: condition.machineProfileId,
    toolProfileId: condition.toolProfileId,
    operationCategory: condition.operationCategory,
    operationSubtype: condition.operationSubtype,
    cuttingSpeed: condition.cuttingSpeed,
    feedPerRevolution: condition.feedPerRevolution,
    feedPerTooth: condition.feedPerTooth,
    feedRate: condition.feedRate,
    depthOfCut: condition.depthOfCut,
    widthOfCut: condition.widthOfCut,
    spindleSpeed: condition.spindleSpeed,
    coolantMode: condition.coolantMode,
    source: condition.source,
    priority: condition.priority,
    confidence: condition.confidence,
    ruleVersion: condition.ruleVersion,
    validFrom: condition.validFrom,
  };
}
