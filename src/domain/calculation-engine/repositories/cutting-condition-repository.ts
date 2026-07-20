import type { OperationCategory } from "../enums/operation-category";
import { CuttingCondition } from "../cutting-conditions/cutting-condition";

/** Kritéria pro dohledání kandidátů úrovní 2/3 §5 (tenant-schválené i obecné
 *  kombinace nástroj/stroj/materiál) - BEZ řazení/filtrování podle priority,
 *  to dělá až `resolveCuttingConditions()` (čistá doménová funkce, žádné I/O). */
export interface CuttingConditionCandidateCriteria {
  tenantId: string;
  materialProfileId: string;
  machineProfileId?: string;
  toolProfileId?: string;
  operationCategory: OperationCategory;
}

/**
 * Tenant-scoped port pro `CuttingCondition` (AP-MCE-001 Fáze B §7).
 *
 * Odlišuje se od `MaterialProfileRepository`/`MachineProfileRepository`/
 * `ToolProfileRepository` ve dvou bodech, oba záměrné:
 *  - žádná `Correction` metoda - `CuttingCondition` nemá overlay systém/tenant
 *    korekce, tenant své vlastní podmínky rovnou UKLÁDÁ jako záznam se
 *    `source: "tenant_approved"` (viz `CuttingConditionFactory`/§5 úroveň 2),
 *    nekoriguje cizí.
 *  - žádné `getSnapshot(id, tenantId)` - snapshot tady není snapshot JEDNOHO
 *    záznamu, ale výsledku `resolveCuttingConditions()` napříč více kandidáty
 *    (`CuttingConditionSnapshot.forResolution`), a ten sestavuje až
 *    `ResolveCuttingConditionsUseCase`, ne repozitář.
 *
 * Žádná metoda nesmí vrátit záznam jiného tenantId (docs/adr/0019).
 */
export interface CuttingConditionRepository {
  getById(id: string, tenantId: string): Promise<CuttingCondition | null>;
  findByExternalReference(externalSystemId: string, externalId: string, tenantId: string): Promise<CuttingCondition | null>;
  listByTenant(tenantId: string): Promise<CuttingCondition[]>;
  save(condition: CuttingCondition): Promise<void>;
  archive(id: string, tenantId: string, archivedAt: string): Promise<void>;
  /** `CuttingCondition` verzuje přes `ruleVersion` (string), ne přes
   *  numerický `recordVersion` jako profily - viz `RuleVersion` (Fáze A). */
  getVersion(id: string, tenantId: string): Promise<string | null>;

  /** Úrovně 2/3 §5 - všichni kandidáti relevantní pro danou kombinaci,
   *  neseřazení (resolver si je sám seřadí přes `bySpecificity`). */
  findCandidates(criteria: CuttingConditionCandidateCriteria): Promise<CuttingCondition[]>;
  /** Úroveň 6 §5 - tenant-wide systémová výchozí hodnota, pokud existuje. */
  findSystemDefault(tenantId: string, operationCategory: OperationCategory): Promise<CuttingCondition | null>;
}
