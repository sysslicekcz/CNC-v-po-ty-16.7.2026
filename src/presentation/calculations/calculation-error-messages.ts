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
import { CalculationIssue } from "@/application/calculation-engine/dto/calculation-engine-ui-types";

/**
 * `CalculationErrorMessageRegistry` (AP-MCE-001 Fáze H §28) - centrální
 * mapování chyb modulu "Výpočty výroby" na srozumitelný český text, stejný
 * vzor jako `describeMasterDataError`/`describeRoutingSheetError` (Krok 4/5).
 * Většina doménových chyb (`CalculationError`, `MaterialError`, `ToolError`,
 * `MachineLimitError`, `ValidationError`, `ProfileVersionConflictError`, ...)
 * už nese hotovou, česky formulovanou `.message` - stačí obecný fallback na
 * `DomainError.message`, žádný need to enumerate them one by one. Speciální
 * text mají jen licenční chyby.
 *
 * §28 "Neztrácej původní error code" - `describeCalculationIssue` níž pro
 * `CalculationIssue` (warning/error z breakdown) vrací text i s originálním
 * `code`, aby uživatel/podpora měli čím dohledat přesné místo v kódu.
 */
export function describeCalculationError(error: unknown): string {
  if (error instanceof FeatureNotLicensedError) {
    return "Tato funkce není součástí vaší licence.";
  }
  if (error instanceof ReadOnlyLicenseError) {
    return "Vaše licence umožňuje pouze prohlížení, ne úpravy nebo výpočty.";
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
  return "Nastala neočekávaná chyba při práci s výpočtem. Zkuste to prosím znovu.";
}

/** Zobrazitelný text pro JEDNU `CalculationIssue` (breakdown warning/error) -
 *  vždy obsahuje původní `code`, nikdy ho nenahrazuje jen lidským textem. */
export function describeCalculationIssue(issue: CalculationIssue): string {
  return `[${issue.code}] ${issue.message}`;
}
