import { ToolRepository } from "@/domain/repositories/tool-repository";
import { Tool } from "@/domain/entities/tool";
import { ToolRecord } from "../records";
import { toolToRecord, toolFromRecord } from "../mappers/tool-mapper";
import { LegacyStamp } from "../mappers/common";
import { tpvGetAll, tpvGet, tpvPut, tpvDelete } from "../tpv-db";

export class IndexedDbToolRepository implements ToolRepository {
  async findById(id: string): Promise<Tool | null> {
    const record = await tpvGet<ToolRecord>("tpvTools", id);
    return record ? toolFromRecord(record) : null;
  }

  async findAll(): Promise<Tool[]> {
    const records = await tpvGetAll<ToolRecord>("tpvTools");
    return records.map(toolFromRecord);
  }

  async save(tool: Tool): Promise<void> {
    const existing = await tpvGet<ToolRecord>("tpvTools", tool.id);
    await tpvPut(
      "tpvTools",
      toolToRecord(tool, {
        legacySource: existing?.legacySource,
        legacyId: existing?.legacyId,
        migrationRunId: existing?.migrationRunId,
      })
    );
  }

  async saveWithLegacyStamp(tool: Tool, stamp: LegacyStamp): Promise<void> {
    await tpvPut("tpvTools", toolToRecord(tool, stamp));
  }

  async delete(id: string): Promise<void> {
    await tpvDelete("tpvTools", id);
  }
}
