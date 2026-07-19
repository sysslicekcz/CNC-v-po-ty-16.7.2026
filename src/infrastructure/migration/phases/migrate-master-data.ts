import { Customer } from "@/domain/entities/customer";
import { Order } from "@/domain/entities/order";
import { Part } from "@/domain/entities/part";
import { Quantity } from "@/domain/value-objects/quantity";
import { IndexedDbCustomerRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-customer-repository";
import { IndexedDbOrderRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-order-repository";
import { IndexedDbPartRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-part-repository";
import { LegacySourceData } from "../legacy-source";
import { MigrationContext } from "../context";
import { deterministicId } from "../id-mapping";

const LEGACY_SOURCE = "customers-inquiries-parts";

/** Customer -> Order -> Part, v tomto pořadí kvůli FK závislostem. Osiřelé
 *  záznamy (Inquiry na neexistujícího Customer, Part na neexistující Order) se
 *  přeskočí s "error" issue (ne fatal) - nejde vytvořit validní doménový objekt
 *  bez rodiče, ale zbytek migrace pokračuje a nic se neztratí ze staré databáze
 *  (ta zůstává nedotčená, viz backup). */
export async function runMigrateMasterDataPhase(
  data: LegacySourceData,
  repos: { customers: IndexedDbCustomerRepository; orders: IndexedDbOrderRepository; parts: IndexedDbPartRepository },
  context: MigrationContext
): Promise<void> {
  for (const customer of data.customers) {
    const newId = deterministicId("customer", customer.id);
    const domainCustomer = Customer.create({
      id: newId,
      nazev: customer.nazev?.trim() || `Zákazník ${customer.id}`,
      stav: "aktivni",
    });
    await repos.customers.saveWithLegacyStamp(domainCustomer, {
      legacySource: "customers",
      legacyId: customer.id,
      migrationRunId: context.migrationRunId,
    });
    context.customerIdMap.set(customer.id, newId);
    context.incrementCounter("created", "customers");
  }

  for (const inquiry of data.inquiries) {
    const newCustomerId = context.customerIdMap.get(inquiry.customerId);
    if (!newCustomerId) {
      context.addIssue({
        severity: "error",
        phase: "migrate-master-data",
        code: "order-skipped-missing-customer",
        message: `Zakázka "${inquiry.id}" přeskočena - odkazovaný zákazník "${inquiry.customerId}" nebyl migrován.`,
        legacySource: LEGACY_SOURCE,
        legacyId: inquiry.id,
      });
      context.incrementCounter("skipped", "orders");
      continue;
    }
    const newId = deterministicId("order", inquiry.id);
    const domainOrder = Order.create({
      id: newId,
      customerId: newCustomerId,
      // Legacy Inquiry nemá číslo zakázky ani stav - deterministický, rozpoznatelný
      // placeholder (zadání, bod 4), uveden i v migračním reportu.
      cisloZakazky: `LEGACY-${inquiry.id}`,
      nazev: inquiry.nazev,
      stav: "nova",
      poznamka: "Migrováno z legacy poptávky/zakázky - původní data neobsahovala odlišení stavu.",
      createdAt: inquiry.createdAt,
    });
    await repos.orders.saveWithLegacyStamp(domainOrder, {
      legacySource: "inquiries",
      legacyId: inquiry.id,
      migrationRunId: context.migrationRunId,
    });
    context.orderIdMap.set(inquiry.id, newId);
    context.incrementCounter("created", "orders");
  }

  for (const part of data.parts) {
    const newOrderId = context.orderIdMap.get(part.inquiryId);
    if (!newOrderId) {
      context.addIssue({
        severity: "error",
        phase: "migrate-master-data",
        code: "part-skipped-missing-order",
        message: `Díl "${part.id}" přeskočen - odkazovaná zakázka "${part.inquiryId}" nebyla migrována.`,
        legacySource: LEGACY_SOURCE,
        legacyId: part.id,
      });
      context.incrementCounter("skipped", "parts");
      continue;
    }
    const newId = deterministicId("part", part.id);
    const domainPart = Part.create({
      id: newId,
      orderId: newOrderId,
      nazev: part.nazev,
      // Legacy Part nemá počet kusů ani jednotku - výchozí 1 ks, zachyceno
      // v poznámce, aby uživatel věděl, že hodnotu má dohledat/doplnit.
      mnozstvi: Quantity.of(1, "ks"),
      cisloVykresu: part.cisloVykresu || undefined,
      poznamka: "Migrováno z legacy dílu - množství (1 ks) je výchozí, legacy data počet kusů neukládala.",
    });
    await repos.parts.saveWithLegacyStamp(domainPart, {
      legacySource: "parts",
      legacyId: part.id,
      migrationRunId: context.migrationRunId,
    });
    context.partIdMap.set(part.id, newId);
    context.incrementCounter("created", "parts");
  }
}
