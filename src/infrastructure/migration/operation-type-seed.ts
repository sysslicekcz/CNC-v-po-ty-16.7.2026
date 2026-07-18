import { OperationType, OperationCategory } from "@/domain/entities/operation-type";
import { OPERATIONS } from "@/lib/operations";
import { deterministicId } from "./id-mapping";

/**
 * Deterministický seed OperationType podle skutečného src/lib/operations.ts
 * (zadání, bod 5). `id` je stabilní mezi spuštěními (žádné náhodné UUID) - druhé
 * spuštění migrace zapíše přes IndexedDB `put()` stejné id, takže žádná
 * duplicita nevznikne (viz docs/adr/0012).
 *
 * `kategorie` je ruční přiřazení (v operations.ts žádná kategorie není) -
 * zdokumentovaný předpoklad, ne odvozený fakt:
 *  - podelneVnejsi/podelneVnitrni/pricne/zapich/celniZapichy/vrtani -> turning
 *    (vrtání je tu typicky na soustruhu, ne na frézce - viz MACHINE_OPERATIONS)
 *  - frezovaniDrazek -> milling
 *  - brouseniNaKulato -> grinding
 *  - pripravneCasy -> preparation (nekontroluje se proti MachineCapability -
 *    přesně odpovídá dnešnímu chování `filterOperationsForMachine`)
 *
 * `kod` = legacy `opId` - v tomhle modelu se `kod` používá i jako
 * "legacyCalculationType" (žádné zvláštní pole navíc, byla by to duplicita).
 */
const CATEGORY_BY_OP_ID: Record<string, OperationCategory> = {
  podelneVnejsi: "turning",
  podelneVnitrni: "turning",
  pricne: "turning",
  vrtani: "turning",
  zapich: "turning",
  celniZapichy: "turning",
  frezovaniDrazek: "milling",
  brouseniNaKulato: "grinding",
  pripravneCasy: "preparation",
};

export function operationTypeSeedId(opId: string): string {
  return deterministicId("operation-type", opId);
}

export function buildOperationTypeSeed(): OperationType[] {
  return OPERATIONS.map((op) =>
    OperationType.create({
      id: operationTypeSeedId(op.id),
      kod: op.id,
      nazev: op.title,
      kategorie: CATEGORY_BY_OP_ID[op.id] ?? "other",
      stav: "aktivni",
    })
  );
}

/** Namapuje libovolný legacy opId na id seedovaného OperationType. Neznámé opId
 *  (uživatelská data starší/novější než tenhle seznam) vrátí undefined - volající
 *  fázi (migrate-machines/migrate-tools/migrate-routing-data) je na starosti
 *  vytvořit k tomu migrační warning, ne migraci zastavit (zadání, bod 4 -
 *  MachineCapability). */
export function buildOpIdToOperationTypeIdMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const op of OPERATIONS) {
    map.set(op.id, operationTypeSeedId(op.id));
  }
  return map;
}
