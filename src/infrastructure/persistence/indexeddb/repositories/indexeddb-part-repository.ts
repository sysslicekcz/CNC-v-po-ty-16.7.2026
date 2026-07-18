import { PartRepository } from "@/domain/repositories/part-repository";
import { Part } from "@/domain/entities/part";
import { PartRecord } from "../records";
import { partToRecord, partFromRecord } from "../mappers/part-mapper";
import { LegacyStamp } from "../mappers/common";
import { tpvGetAll, tpvGetAllByIndex, tpvGet, tpvPut, tpvDelete } from "../tpv-db";

export class IndexedDbPartRepository implements PartRepository {
  async findById(id: string): Promise<Part | null> {
    const record = await tpvGet<PartRecord>("tpvParts", id);
    return record ? partFromRecord(record) : null;
  }

  async findAll(): Promise<Part[]> {
    const records = await tpvGetAll<PartRecord>("tpvParts");
    return records.map(partFromRecord);
  }

  async save(part: Part): Promise<void> {
    const existing = await tpvGet<PartRecord>("tpvParts", part.id);
    await tpvPut(
      "tpvParts",
      partToRecord(part, {
        legacySource: existing?.legacySource,
        legacyId: existing?.legacyId,
        migrationRunId: existing?.migrationRunId,
      })
    );
  }

  async saveWithLegacyStamp(part: Part, stamp: LegacyStamp): Promise<void> {
    await tpvPut("tpvParts", partToRecord(part, stamp));
  }

  async delete(id: string): Promise<void> {
    await tpvDelete("tpvParts", id);
  }

  async findByOrderId(orderId: string): Promise<Part[]> {
    const records = await tpvGetAllByIndex<PartRecord>("tpvParts", "orderId", orderId);
    return records.map(partFromRecord);
  }
}
