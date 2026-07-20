import { OperationCalculationInputBase } from "@/domain/calculation-engine/contracts/operation-calculation-input";

/**
 * Application DTO pro AP-MCE-001 §12 `POST /calculations/operations` -
 * ROZŠIŘUJE doménový `OperationCalculationInputBase` o obálku požadavku
 * (idempotence, volitelná konkrétní verze pravidel, kdo o výpočet žádá).
 * Tenhle směr závislosti (Application -> Domain) je v pořádku, opačný by
 * porušil vrstvení - viz komentář u `OperationCalculationInputBase`.
 *
 * `tenantId` se sem záměrně NEDÁVÁ - stejně jako u všech ostatních use casů v
 * appce ho určuje `TenantContext` na základě přihlášené organizace, nikdy
 * hodnota od volajícího (AP-MCE-001 §09: tenant scoping je infrastrukturní/
 * aplikační záležitost, ne něco, co si "vybírá" požadavek).
 */
export interface OperationCalculationInput extends OperationCalculationInputBase {
  /** Vyžadováno na KAŽDÉM volání, co něco mutuje (AP-MCE-001 §12) - opakované
   *  volání se stejným klíčem nevytvoří druhý výpočet. */
  idempotencyKey: string;
  /** Nepovinné - `omitted = current active` (AP-MCE-001 §12). */
  ruleVersionId?: string;
  requestedBy?: string;
}
