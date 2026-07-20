import type { OperationCategory } from "../enums/operation-category";

/**
 * Sdílený, doménový tvar vstupu jedné operace (AP-MCE-001 §04 "Společné
 * vstupy") - jen pole, která Fáze A skutečně validuje a se kterými `Default
 * CalculationEngine`/`CalculationStrategy` pracují. Rozšíření pro konkrétní
 * kategorie (soustružení: `startDiameterMm`/`machiningLengthMm`/...,
 * frézování, broušení - AP-MCE-001 §04) přibudou jako DALŠÍ, volitelná pole
 * až s konkrétními strategiemi (Fáze C-E), ne teď - žádná strategie pro ně
 * ještě neexistuje, přidávat pole, která nikdo nečte, by bylo mrtvé rozhraní.
 *
 * Tohle je DOMÉNOVÝ kontrakt, ne Application DTO - `application/calculation-
 * engine/dto/operation-calculation-input.ts` ho rozšiřuje (nikdy nekopíruje)
 * o obálku požadavku (idempotency klíč, explicitní `ruleVersionId`, ...).
 * Domain layer takhle nikdy nezávisí na Application (opačný směr by porušil
 * vrstvení, viz `architecture-tests`).
 *
 * `materialId`/`machineId`/`toolId` jsou vždy INTERNÍ id (stejná zásada jako
 * všude v platformě) - nikdy ERP kód; mapování na ERP dělá až Connector
 * Framework přes existující `ExternalReference`, mimo tenhle modul.
 */
export interface OperationCalculationInputBase {
  operationCategory: OperationCategory;
  operationTypeId: string;
  /** Počet kusů - validováno jako `Quantity.ofPieces` (> 0, celé číslo). */
  quantity: number;
  materialId: string;
  /** Nepovinné - operace bez stroje (např. ruční operace/kontrola) žádný
   *  nemají (`OperationType.resourceRequirement === "none"`). Pokud je
   *  vyplněné, `CalculateOperationUseCase` ověří, že stroj existuje. */
  machineId?: string;
  /** Nepovinné ze stejného důvodu jako `machineId`. */
  toolId?: string;
  /** Validováno jako `Diameter.ofMillimeters` (> 0), POKUD je vyplněné -
   *  ne každá kategorie operace průměr používá (např. `manual`/`inspection`). */
  diameterMm?: number;
  /** Validováno jako `SpindleSpeed.ofRpm` (> 0), POKUD je vyplněné. */
  spindleSpeedRpm?: number;
}
