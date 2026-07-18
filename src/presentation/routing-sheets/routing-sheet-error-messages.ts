import { NotFoundError } from "@/domain/errors/not-found-error";
import { InvalidStateError } from "@/domain/errors/invalid-state-error";
import { ConcurrentModificationError } from "@/domain/errors/routing-sheet-errors";
import {
  FeatureNotLicensedError,
  ReadOnlyLicenseError,
  LicenseExpiredError,
  LicenseSuspendedError,
  LicenseUnavailableError,
  TenantNotActiveError,
  LicenseLimitExceededError,
} from "@/domain/errors/license-errors";
import { RoutingSheetValidationError, RoutingSheetDraftAlreadyExistsError } from "@/application/routing-sheets/errors";

/**
 * Mapování doménových/aplikačních chyb na srozumitelnou českou zprávu pro
 * uživatele (Krok 4, zadání bod 49) - technický detail (typ chyby, stack) se
 * loguje zvlášť (`console.error`, viz volající místo), uživatel dostane jen
 * tenhle text. `RoutingSheetNotFoundError`/`RoutingSheetNotEditableError`/
 * `RoutingSheetAlreadyReleasedError`/`MachineNotFoundError`/
 * `ExternalResourceNotFoundError`/`PersistenceError` ze zadání nejsou
 * samostatné třídy - pokrývá je obecné `NotFoundError`/`InvalidStateError`
 * parametrizované jménem entity (viz docs/audits/step-4-audit.md).
 */
export function describeRoutingSheetError(error: unknown): string {
  if (error instanceof RoutingSheetValidationError) {
    return `Postup nelze vydat - ${error.issues.length} blokujících chyb. Opravte je a zkuste to znovu.`;
  }
  if (error instanceof RoutingSheetDraftAlreadyExistsError) {
    return "Tento díl už má rozpracovaný draft - otevřete ho místo založení nového.";
  }
  if (error instanceof ConcurrentModificationError) {
    return "Data byla mezitím změněna jinou relací. Načtěte postup znovu a proveďte úpravy znovu.";
  }
  if (error instanceof NotFoundError) {
    return "Technologický postup nebyl nalezen.";
  }
  if (error instanceof InvalidStateError) {
    return error.message;
  }
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
    return "Byl by překročen licenční limit.";
  }
  return "Nastala neočekávaná chyba. Zkuste to prosím znovu.";
}
