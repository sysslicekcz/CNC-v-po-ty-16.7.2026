import { RuleVersion } from "../rules/rule-version";

/**
 * Tenant-scoped repozitář pro `RuleVersion` (AP-MCE-001 §09/§21 Fáze A -
 * "shared domain model, units, validation" potřebuje aspoň tohle minimum, aby
 * `CalculateOperationUseCase` měl odkud vzít "aktuálně platnou" verzi pravidel,
 * když volající API kontrakt žádnou konkrétní neuvede (AP-MCE-001 §12:
 * `ruleVersionId` je na vstupu nepovinné, "omitted = current active").
 */
export interface RuleRepository {
  /** Právě jedna `RuleVersion` se `status === "active"` na tenanta - pokud
   *  žádná neexistuje, use case to musí ošetřit jako chybu konfigurace, ne
   *  jako `null`, který by tiše propadl do výpočtu bez pravidel. */
  findActiveVersion(tenantId: string): Promise<RuleVersion | null>;
  findById(id: string, tenantId: string): Promise<RuleVersion | null>;
  save(ruleVersion: RuleVersion): Promise<void>;
}
