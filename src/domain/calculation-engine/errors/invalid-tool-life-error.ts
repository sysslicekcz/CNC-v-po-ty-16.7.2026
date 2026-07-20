import { DomainError } from "@/domain/errors/domain-error";

/**
 * Neplatný vstup pro výpočet životnosti nástroje (AP-MCE-001 Fáze B §14) -
 * Application-vrstvá obdoba `ValidationError`, kterou vyhazuje `ToolLife
 * Profile.expectedToolChanges` (Domain) - use case tuhle chybu použije, když
 * je neplatná hodnota už na vstupu DTO (dřív, než se vůbec zavolá doménová
 * metoda), aby volající dostal chybu specifickou pro tenhle modul, ne obecný
 * `ValidationError`.
 */
export class InvalidToolLifeError extends DomainError {
  constructor(readonly toolProfileId: string, readonly reason: string) {
    super(`Neplatná životnost nástroje pro ToolProfile "${toolProfileId}": ${reason}`);
  }
}
