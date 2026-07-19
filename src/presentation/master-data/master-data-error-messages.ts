import { DomainError } from "@/domain/errors/domain-error";
import {
  FeatureNotLicensedError,
  ReadOnlyLicenseError,
  LicenseExpiredError,
  LicenseSuspendedError,
  LicenseUnavailableError,
  TenantNotActiveError,
  LicenseLimitExceededError,
} from "@/domain/errors/license-errors";

/**
 * Mapování chyb kmenových dat (Krok 5) na srozumitelnou českou zprávu -
 * stejný vzor jako `routing-sheet-error-messages.ts` z Kroku 4. Většina
 * doménových chyb Kroku 5 (`MasterDataCodeAlreadyExistsError`,
 * `MasterDataInUseError`, `MasterDataInactiveError`, `InvalidMasterDataValueError`,
 * `NotFoundError`, `*CodeAlreadyExistsError`, `ValidationError`) už nese
 * hotovou, česky formulovanou `.message` - není potřeba je vyjmenovávat
 * jednotlivě, stačí obecný fallback na `DomainError.message`. Speciální
 * zacházení mají jen licenční chyby (potřebují jiný text než technický
 * `featureCode`/`limitCode`).
 */
export function describeMasterDataError(error: unknown): string {
  if (error instanceof FeatureNotLicensedError) {
    return "Tato funkce není součástí vaší licence.";
  }
  if (error instanceof ReadOnlyLicenseError) {
    return "Vaše licence umožňuje pouze prohlížení, ne úpravy.";
  }
  if (error instanceof LicenseExpiredError) {
    return "Licence organizace vypršela.";
  }
  if (error instanceof LicenseSuspendedError) {
    return "Licence organizace je pozastavená.";
  }
  if (error instanceof LicenseUnavailableError) {
    return "Pro organizaci není dostupná žádná licence.";
  }
  if (error instanceof TenantNotActiveError) {
    return "Organizace není aktivní.";
  }
  if (error instanceof LicenseLimitExceededError) {
    return `Byl by překročen licenční limit "${error.limitCode}" (max. ${error.limit}).`;
  }
  if (error instanceof DomainError) {
    return error.message;
  }
  return "Nastala neočekávaná chyba. Zkuste to prosím znovu.";
}
