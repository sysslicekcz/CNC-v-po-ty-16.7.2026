import { ToolMachineConditionRepository } from "@/domain/repositories/tool-machine-condition-repository";
import { ToolMachineCondition } from "@/domain/entities/tool-machine-condition";
import { ToolMachineConditionRecord } from "../records";
import { toolMachineConditionToRecord, toolMachineConditionFromRecord } from "../mappers/tool-machine-condition-mapper";
import { LegacyStamp } from "../mappers/common";
import { tpvGetAll, tpvGetAllByIndex, tpvGet, tpvPut, tpvDelete } from "../tpv-db";

export class IndexedDbToolMachineConditionRepository implements ToolMachineConditionRepository {
  async findById(id: string): Promise<ToolMachineCondition | null> {
    const record = await tpvGet<ToolMachineConditionRecord>("tpvToolMachineConditions", id);
    return record ? toolMachineConditionFromRecord(record) : null;
  }

  async findAll(): Promise<ToolMachineCondition[]> {
    const records = await tpvGetAll<ToolMachineConditionRecord>("tpvToolMachineConditions");
    return records.map(toolMachineConditionFromRecord);
  }

  async save(condition: ToolMachineCondition): Promise<void> {
    const existing = await tpvGet<ToolMachineConditionRecord>("tpvToolMachineConditions", condition.id);
    await tpvPut(
      "tpvToolMachineConditions",
      toolMachineConditionToRecord(condition, {
        legacySource: existing?.legacySource,
        legacyId: existing?.legacyId,
        migrationRunId: existing?.migrationRunId,
      })
    );
  }

  async saveWithLegacyStamp(condition: ToolMachineCondition, stamp: LegacyStamp): Promise<void> {
    await tpvPut("tpvToolMachineConditions", toolMachineConditionToRecord(condition, stamp));
  }

  async delete(id: string): Promise<void> {
    await tpvDelete("tpvToolMachineConditions", id);
  }

  async findByToolAndMachine(toolId: string, machineId: string): Promise<ToolMachineCondition[]> {
    const records = await tpvGetAllByIndex<ToolMachineConditionRecord>("tpvToolMachineConditions", "toolId", toolId);
    return records.filter((r) => r.machineId === machineId).map(toolMachineConditionFromRecord);
  }
}
