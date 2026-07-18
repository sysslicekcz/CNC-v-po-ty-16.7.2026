import { ToolTypeRepository } from "@/domain/repositories/tool-type-repository";
import { ToolType } from "@/domain/entities/tool-type";
import { ToolTypeRecord } from "../records";
import { toolTypeToRecord, toolTypeFromRecord } from "../mappers/tool-type-mapper";
import { tpvGetAll, tpvGet, tpvPut, tpvDelete } from "../tpv-db";

export class IndexedDbToolTypeRepository implements ToolTypeRepository {
  async findById(id: string): Promise<ToolType | null> {
    const record = await tpvGet<ToolTypeRecord>("tpvToolTypes", id);
    return record ? toolTypeFromRecord(record) : null;
  }

  async findAll(): Promise<ToolType[]> {
    const records = await tpvGetAll<ToolTypeRecord>("tpvToolTypes");
    return records.map(toolTypeFromRecord);
  }

  async save(toolType: ToolType): Promise<void> {
    await tpvPut("tpvToolTypes", toolTypeToRecord(toolType));
  }

  async delete(id: string): Promise<void> {
    await tpvDelete("tpvToolTypes", id);
  }
}
