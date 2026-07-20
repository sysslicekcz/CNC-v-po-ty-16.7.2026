import { DomainError } from "@/domain/errors/domain-error";

/**
 * Pokus přečíst/zapsat záznam patřící jinému tenantovi (AP-MCE-001 Fáze B
 * §7/§14/docs/adr/0019 - "žádná metoda repozitáře nesmí vrátit záznam jiného
 * tenantId"). Repozitáře samy tichu vrací `null` pro cizí `tenantId` (nikdy
 * data neprozradí existencí chyby), tuhle chybu vyhazují use casy/resolvery,
 * když detekují neshodu `tenantId` MEZI dvěma už NAČTENÝMI záznamy (např.
 * `MaterialCorrection.tenantId` neodpovídá aktuálnímu `TenantContext`), což
 * by jinak tiše prošlo přes `null`-návrat repozitáře.
 */
export class CrossTenantAccessError extends DomainError {
  constructor(readonly entityName: string, readonly entityId: string, readonly expectedTenantId: string) {
    super(`Přístup k záznamu "${entityName}" (${entityId}) mimo tenanta "${expectedTenantId}" byl odmítnut.`);
  }
}
