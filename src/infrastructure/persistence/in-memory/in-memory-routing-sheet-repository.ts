import { RoutingSheet } from "@/domain/aggregates/routing-sheet/routing-sheet";
import { RoutingSheetRepository } from "@/domain/repositories/routing-sheet-repository";

/**
 * In-memory implementace RoutingSheetRepository - pro testy domény a jako
 * referenční implementace rozhraní. Žádná produkční IndexedDB implementace se
 * v tomto kroku nepřipojuje (zadání, bod 13: "V tomto kroku zatím nemusíš
 * připojit produkční IndexedDB implementaci.").
 *
 * Ukládá přímo referenci na agregát (žádná serializace) - to je v pořádku pro
 * testy, ale záměrně by to NEBYLO v pořádku pro produkční repozitář (tam je
 * nutné mapování Domain Entity <-> Persistence Record, viz zadání, bod 12).
 */
export class InMemoryRoutingSheetRepository implements RoutingSheetRepository {
  private readonly store = new Map<string, RoutingSheet>();

  async findById(id: string): Promise<RoutingSheet | null> {
    return this.store.get(id) ?? null;
  }

  async findByPartId(partId: string): Promise<RoutingSheet[]> {
    return [...this.store.values()].filter((rs) => rs.partId === partId);
  }

  async save(routingSheet: RoutingSheet): Promise<void> {
    this.store.set(routingSheet.id, routingSheet);
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }
}
