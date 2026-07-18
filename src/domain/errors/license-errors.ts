import { DomainError } from "./domain-error";
import { FeatureCode } from "../licensing/feature-code";
import { LicenseLimitCode } from "../licensing/license-limit-code";

/** Organizace nemá licencovaný přístup k dané funkci vůbec. */
export class FeatureNotLicensedError extends DomainError {
  constructor(readonly featureCode: FeatureCode) {
    super(`Funkce "${featureCode}" není součástí licence této organizace.`);
  }
}

/** Licence platnosti vypršela (validUntil je v minulosti). */
export class LicenseExpiredError extends DomainError {
  constructor(readonly tenantId: string) {
    super(`Licence organizace "${tenantId}" vypršela.`);
  }
}

/** Licence je administrativně pozastavená. */
export class LicenseSuspendedError extends DomainError {
  constructor(readonly tenantId: string) {
    super(`Licence organizace "${tenantId}" je pozastavená.`);
  }
}

/** Pro tenanta neexistuje žádná licence (a chybí bezpečný fallback). */
export class LicenseUnavailableError extends DomainError {
  constructor(readonly tenantId: string) {
    super(`Pro organizaci "${tenantId}" není dostupná žádná licence.`);
  }
}

/** Funkce je v licenci jen ke čtení ("read"), ale požaduje se zápis. */
export class ReadOnlyLicenseError extends DomainError {
  constructor(readonly featureCode: FeatureCode) {
    super(`Funkce "${featureCode}" je v licenci dostupná jen pro čtení.`);
  }
}

/** Požadovaná hodnota by překročila licenční limit. */
export class LicenseLimitExceededError extends DomainError {
  constructor(
    readonly limitCode: LicenseLimitCode,
    readonly limit: number,
    readonly requestedValue: number
  ) {
    super(`Limit "${limitCode}" (${limit}) by byl překročen požadovanou hodnotou ${requestedValue}.`);
  }
}

/** Tenant není ve stavu "active" (trial/suspended/inactive) - akce vyžadující
 *  aktivní organizaci se neprovede. */
export class TenantNotActiveError extends DomainError {
  constructor(readonly tenantId: string) {
    super(`Organizace "${tenantId}" není aktivní.`);
  }
}
