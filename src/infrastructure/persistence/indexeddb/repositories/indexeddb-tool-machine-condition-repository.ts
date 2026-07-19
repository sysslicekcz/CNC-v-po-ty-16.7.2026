import { ToolMachineConditionRepository } from "@/domain/repositories/tool-machine-condition-repository";
import { ToolMachineCondition } from "@/domain/entities/tool-machine-condition";
import { ToolMachineConditionRecord } from "../records";
import { toolMachineConditionToRecord, toolMachineConditionFromRecord } from "../mappers/tool-machine-condition-mapper";
import { LegacyStamp } from "../mappers/common";
import { tpvGetAllByIndex, tpvGet, tpvPut, tpvDelete } from "../tpv-db";

/** Tenant-scoped od Kroku 5 - stejný důvod jako IndexedDbMachineCapabilityRepository. */
export class IndexedDbToolMachineConditionRepository implements ToolMachineConditionRepository {
  async findById(id: string, tenantId: string): Promise<ToolMachineCondition | null> {
    const record = await tpvGet<ToolMachineConditionRecord>("tpvToolMachineConditions", id);
    if (!record || record.tenantId !== tenantId) return null;
    return toolMachineConditionFromRecord(record);
  }

  async list(tenantId: string): Promise<ToolMachineCondition[]> {
    const records = await tpvGetAllByIndex<ToolMachineConditionRecord>("tpvToolMachineConditions", "tenantId", tenantId);
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

  async delete(id: string, tenantId: string): Promise<void> {
    const existing = await tpvGet<ToolMachineConditionRecord>("tpvToolMachineConditions", id);
    if (!existing || existing.tenantId !== tenantId) return;
    await tpvDelete("tpvToolMachineConditions", id);
  }

  async findByToolAndMachine(toolId: string, machineId: string, tenantId: string): Promise<ToolMachineCondition[]> {
    const records = await tpvGetAllByIndex<ToolMachineConditionRecord>("tpvToolMachineConditions", "toolId", toolId);
    return records.filter((r) => r.machineId === machineId && r.tenantId === tenantId).map(toolMachineConditionFromRecord);
  }

  async findByToolId(toolId: string, tenantId: string): Promise<ToolMachineCondition[]> {
    const records = await tpvGetAllByIndex<ToolMachineConditionRecord>("tpvToolMachineConditions", "toolId", toolId);
    return records.filter((r) => r.tenantId === tenantId).map(toolMachineConditionFromRecord);
  }
}
