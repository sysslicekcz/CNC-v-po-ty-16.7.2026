import { DomainError } from "@/domain/errors/domain-error";
import { RoutingValidationIssueDto } from "./dto/routing-validation-issue-dto";

/** Release validace selhala - obsahuje VŠECHNY blokující nálezy najednou (ne jen
 *  první), aby uživatel nemusel opravovat a znovu klikat na "Vydat" pro každou
 *  chybu zvlášť (zadání Krok 4, bod 27: "Při chybě validace neprováděj částečný
 *  release"). Application-layer chyba (ne domain/errors) - nese
 *  `RoutingValidationIssueDto`, což je editor/aplikační DTO, ne doménový typ. */
export class RoutingSheetValidationError extends DomainError {
  constructor(readonly issues: RoutingValidationIssueDto[]) {
    super(`Technologický postup nelze vydat - nalezeno ${issues.length} blokujících chyb.`);
  }
}

/** Díl už má rozpracovaný (draft) technologický postup - nový se nezakládá,
 *  dokud se ten stávající nevydá nebo nesmaže (viz RoutingSheetRepository.findDraftByPartId). */
export class RoutingSheetDraftAlreadyExistsError extends DomainError {
  constructor(
    readonly partId: string,
    readonly existingDraftId: string
  ) {
    super(`Díl "${partId}" už má rozpracovaný draft technologického postupu ("${existingDraftId}").`);
  }
}
