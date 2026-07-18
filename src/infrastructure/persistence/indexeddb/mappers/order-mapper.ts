import { Order, OrderStav } from "@/domain/entities/order";
import { OrderRecord } from "../records";
import { LegacyStamp } from "./common";
import { ValidationError } from "@/domain/errors/validation-error";

const ORDER_STAV_VALUES: OrderStav[] = ["nova", "v-reseni", "hotovo", "zrusena"];

function parseOrderStav(value: string): OrderStav {
  if (!ORDER_STAV_VALUES.includes(value as OrderStav)) {
    throw new ValidationError(`Order: neplatná hodnota stav "${value}".`);
  }
  return value as OrderStav;
}

export function orderToRecord(order: Order, legacy: LegacyStamp = {}): OrderRecord {
  return {
    id: order.id,
    customerId: order.customerId,
    cisloZakazky: order.cisloZakazky,
    nazev: order.nazev,
    stav: order.stav,
    termin: order.termin,
    poznamka: order.poznamka,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    ...legacy,
  };
}

export function orderFromRecord(record: OrderRecord): Order {
  return Order.restore({
    id: record.id,
    customerId: record.customerId,
    cisloZakazky: record.cisloZakazky,
    nazev: record.nazev,
    stav: parseOrderStav(record.stav),
    termin: record.termin,
    poznamka: record.poznamka,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}
