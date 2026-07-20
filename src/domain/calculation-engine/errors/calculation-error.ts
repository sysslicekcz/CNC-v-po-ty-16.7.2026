import { DomainError } from "@/domain/errors/domain-error";

/**
 * Obecná chyba orchestrace výpočtu (AP-MCE-001 §18/§24) - použije se všude
 * tam, kde selhání nepatří konkrétně k materiálu/stroji/nástroji (viz
 * `MaterialError`/`MachineLimitError`/`ToolError`), např. neznámá kategorie
 * operace v registru strategií nebo neočekávaná chyba uvnitř strategie.
 *
 * Vstupní validace jednotlivých hodnotových objektů (množství, průměr,
 * otáčky, ...) používá existující `@/domain/errors/validation-error`
 * (re-exportovaný z `./index` pro pohodlný import v tomhle modulu) - nový,
 * konkurenční `ValidationError` se v tomhle modulu nezavádí.
 */
export class CalculationError extends DomainError {
  constructor(message: string) {
    super(message);
  }
}

/** Registr strategií nezná kategorii operace, kterou dostal na vstupu
 *  (AP-MCE-001 §11) - typicky proto, že strategie pro danou kategorii ještě
 *  v aktuální fázi neexistuje (Fáze A žádnou konkrétní strategii neregistruje). */
export class UnknownOperationCategoryError extends CalculationError {
  constructor(readonly operationCategory: string) {
    super(`Pro kategorii operace "${operationCategory}" není registrovaná žádná CalculationStrategy.`);
  }
}
