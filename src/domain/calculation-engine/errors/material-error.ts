import { DomainError } from "@/domain/errors/domain-error";

/**
 * Chyby týkající se materiálu jako vstupu výpočtu (AP-MCE-001 §18: "chybějící
 * materiál"). Nenahrazuje `NotFoundError` obecně - je to specifický typ chyby
 * pro tenhle modul, aby volající (use case i budoucí Presentation) mohl
 * materiálové chyby odchytit/zobrazit odlišně od strojních/nástrojových.
 */
export class MaterialError extends DomainError {
  constructor(message: string) {
    super(message);
  }

  static notFound(materialId: string): MaterialError {
    return new MaterialError(`Materiál "${materialId}" nebyl nalezen.`);
  }
}
