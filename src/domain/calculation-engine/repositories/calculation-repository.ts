import { CalculationRequest } from "../entities/calculation-request";
import { CalculationResult } from "../entities/calculation-result";

/**
 * Tenant-scoped repozitář pro `CalculationRequest`/`CalculationResult`
 * (AP-MCE-001 §09) - stejný vzor jako `MachineRepository`/`SupplierRepository`:
 * `findBy*` bere `tenantId` explicitně a interně ověří, že vrácený záznam
 * patří volajícímu tenantovi (docs/adr/0019).
 *
 * Jeden repozitář pro OBĚ entity (ne dva samostatné) - `CalculationRequest` a
 * `CalculationResult` spolu vždy vznikají v jedné transakci use casu
 * (`CalculateOperationUseCase`) a nemá smysl je rozdělovat na dvě závislosti.
 *
 * `findRequestByIdempotencyKey` podporuje idempotenci z AP-MCE-001 §12 -
 * use case ho zavolá PŘED vytvořením nového požadavku, aby opakované volání
 * se stejným klíčem vrátilo původní výsledek místo druhého výpočtu.
 *
 * `listResultsByTenant` doplněno ve Fázi G (§6/§23) - kandidáti pro
 * `ActualTimeCalculationMatcher`, viz jeho komentář.
 */
export interface CalculationRepository {
  saveRequest(request: CalculationRequest): Promise<void>;
  findRequestById(id: string, tenantId: string): Promise<CalculationRequest | null>;
  findRequestByIdempotencyKey(idempotencyKey: string, tenantId: string): Promise<CalculationRequest | null>;

  saveResult(result: CalculationResult): Promise<void>;
  findResultById(id: string, tenantId: string): Promise<CalculationResult | null>;
  /** Všechny revize (viz `CalculationResult.supersedesResultId`) vzniklé z
   *  jednoho požadavku, nejnovější první. */
  findResultsByRequestId(calculationRequestId: string, tenantId: string): Promise<CalculationResult[]>;
  /** AP-MCE-001 Fáze G §6 - "Calculation history"/kandidáti pro
   *  `ActualTimeCalculationMatcher` (volající si k výsledku dál dotáhne
   *  `findRequestById(result.calculationRequestId, tenantId)` pro
   *  `operationCategory`/`machineId`/... z `inputSnapshot` - viz předchozí
   *  TODO komentář u tohohle rozhraní, teď doplněno). */
  listResultsByTenant(tenantId: string): Promise<CalculationResult[]>;
}
