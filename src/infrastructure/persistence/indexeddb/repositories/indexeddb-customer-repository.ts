import { CustomerRepository } from "@/domain/repositories/customer-repository";
import { Customer } from "@/domain/entities/customer";
import { Ico } from "@/domain/value-objects/ico";
import { CustomerRecord } from "../records";
import { customerToRecord, customerFromRecord } from "../mappers/customer-mapper";
import { LegacyStamp } from "../mappers/common";
import { tpvGetAll, tpvGet, tpvPut, tpvDelete } from "../tpv-db";

export class IndexedDbCustomerRepository implements CustomerRepository {
  async findById(id: string): Promise<Customer | null> {
    const record = await tpvGet<CustomerRecord>("tpvCustomers", id);
    return record ? customerFromRecord(record) : null;
  }

  async findAll(): Promise<Customer[]> {
    const records = await tpvGetAll<CustomerRecord>("tpvCustomers");
    return records.map(customerFromRecord);
  }

  /** Zachová legacy stamp existujícího záznamu při běžné aktualizaci přes
   *  Application vrstvu (read-modify-write). */
  async save(customer: Customer): Promise<void> {
    const existing = await tpvGet<CustomerRecord>("tpvCustomers", customer.id);
    await tpvPut(
      "tpvCustomers",
      customerToRecord(customer, {
        legacySource: existing?.legacySource,
        legacyId: existing?.legacyId,
        migrationRunId: existing?.migrationRunId,
      })
    );
  }

  /** Jen pro infrastructure/migration - zapíše explicitní legacy stamp, aby byl
   *  migrovaný záznam dohledatelný a rollbacknutelný (viz zadání, bod 9, 15). */
  async saveWithLegacyStamp(customer: Customer, stamp: LegacyStamp): Promise<void> {
    await tpvPut("tpvCustomers", customerToRecord(customer, stamp));
  }

  async delete(id: string): Promise<void> {
    await tpvDelete("tpvCustomers", id);
  }

  async findByIco(ico: Ico): Promise<Customer | null> {
    const all = await this.findAll();
    return all.find((c) => c.ico?.equals(ico)) ?? null;
  }

  async search(query: string): Promise<Customer[]> {
    const q = query.trim().toLowerCase();
    const all = await this.findAll();
    return q ? all.filter((c) => c.nazev.toLowerCase().includes(q)) : all;
  }
}
