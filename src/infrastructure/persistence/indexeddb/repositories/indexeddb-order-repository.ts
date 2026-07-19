import { OrderRepository } from "@/domain/repositories/order-repository";
import { Order } from "@/domain/entities/order";
import { OrderRecord } from "../records";
import { orderToRecord, orderFromRecord } from "../mappers/order-mapper";
import { LegacyStamp } from "../mappers/common";
import { tpvGetAll, tpvGetAllByIndex, tpvGet, tpvPut, tpvDelete } from "../tpv-db";

export class IndexedDbOrderRepository implements OrderRepository {
  async findById(id: string): Promise<Order | null> {
    const record = await tpvGet<OrderRecord>("tpvOrders", id);
    return record ? orderFromRecord(record) : null;
  }

  async findAll(): Promise<Order[]> {
    const records = await tpvGetAll<OrderRecord>("tpvOrders");
    return records.map(orderFromRecord);
  }

  async save(order: Order): Promise<void> {
    const existing = await tpvGet<OrderRecord>("tpvOrders", order.id);
    await tpvPut(
      "tpvOrders",
      orderToRecord(order, {
        legacySource: existing?.legacySource,
        legacyId: existing?.legacyId,
        migrationRunId: existing?.migrationRunId,
      })
    );
  }

  async saveWithLegacyStamp(order: Order, stamp: LegacyStamp): Promise<void> {
    await tpvPut("tpvOrders", orderToRecord(order, stamp));
  }

  async delete(id: string): Promise<void> {
    await tpvDelete("tpvOrders", id);
  }

  async findByCustomerId(customerId: string): Promise<Order[]> {
    const records = await tpvGetAllByIndex<OrderRecord>("tpvOrders", "customerId", customerId);
    return records.map(orderFromRecord);
  }
}
