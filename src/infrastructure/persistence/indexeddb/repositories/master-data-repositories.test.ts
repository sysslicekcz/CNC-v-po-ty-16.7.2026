import { describe, it, expect, beforeEach } from "vitest";
import { Customer } from "@/domain/entities/customer";
import { Order } from "@/domain/entities/order";
import { Part } from "@/domain/entities/part";
import { Quantity } from "@/domain/value-objects/quantity";
import { Ico } from "@/domain/value-objects/ico";
import { IndexedDbCustomerRepository } from "./indexeddb-customer-repository";
import { IndexedDbOrderRepository } from "./indexeddb-order-repository";
import { IndexedDbPartRepository } from "./indexeddb-part-repository";
import { deleteTpvDbForTests } from "../tpv-db";

describe("master data repositories (Customer/Order/Part) CRUD", () => {
  beforeEach(async () => {
    await deleteTpvDbForTests();
  });

  it("Customer: uloží, najde, aktualizuje a smaže", async () => {
    const repo = new IndexedDbCustomerRepository();
    const customer = Customer.create({ id: "cust-1", nazev: "ACME s.r.o.", stav: "aktivni", ico: Ico.of("27074358") });
    await repo.save(customer);

    const found = await repo.findById("cust-1");
    expect(found?.nazev).toBe("ACME s.r.o.");
    expect(found?.ico?.toString()).toBe("27074358");

    const byIco = await repo.findByIco(Ico.of("27074358"));
    expect(byIco?.id).toBe("cust-1");

    found!.rename("ACME a.s.");
    await repo.save(found!);
    expect((await repo.findById("cust-1"))?.nazev).toBe("ACME a.s.");

    await repo.delete("cust-1");
    expect(await repo.findById("cust-1")).toBeNull();
  });

  it("Order: uloží, najde podle customerId, aktualizuje", async () => {
    const repo = new IndexedDbOrderRepository();
    const order = Order.create({
      id: "order-1",
      customerId: "cust-1",
      cisloZakazky: "Z-2026-001",
      nazev: "Zakázka A",
      stav: "nova",
      createdAt: 1000,
    });
    await repo.save(order);

    const byCustomer = await repo.findByCustomerId("cust-1");
    expect(byCustomer).toHaveLength(1);

    const found = await repo.findById("order-1");
    found!.setStav("v-reseni", 2000);
    await repo.save(found!);
    expect((await repo.findById("order-1"))?.stav).toBe("v-reseni");

    await repo.delete("order-1");
    expect(await repo.findById("order-1")).toBeNull();
  });

  it("Part: uloží, najde podle orderId, smaže", async () => {
    const repo = new IndexedDbPartRepository();
    const part = Part.create({
      id: "part-1",
      orderId: "order-1",
      nazev: "Hřídel",
      mnozstvi: Quantity.of(5, "ks"),
      cisloVykresu: "V-001",
    });
    await repo.save(part);

    const byOrder = await repo.findByOrderId("order-1");
    expect(byOrder).toHaveLength(1);
    expect(byOrder[0].label).toBe("V-001 · Hřídel");

    await repo.delete("part-1");
    expect(await repo.findById("part-1")).toBeNull();
  });
});
