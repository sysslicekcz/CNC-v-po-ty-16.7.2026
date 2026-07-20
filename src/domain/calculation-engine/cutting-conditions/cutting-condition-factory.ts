import { ToolMachineCondition } from "@/domain/entities/tool-machine-condition";
import { CuttingCondition, CuttingConditionSource } from "./cutting-condition";
import { CuttingSpeed } from "../value-objects/cutting-speed";
import { FeedRate, FeedRateUnit } from "../value-objects/feed-rate";
import { Length } from "../value-objects/length";
import type { OperationCategory } from "../enums/operation-category";

const SOURCE_MAP: Record<NonNullable<ToolMachineCondition["source"]>, CuttingConditionSource> = {
  manufacturer: "tool_recommendation",
  internal: "tenant_approved",
  calculated: "system_default",
  manual: "tenant_approved",
};

export interface CreateCuttingConditionFromToolMachineConditionInput {
  condition: ToolMachineCondition;
  materialProfileId: string;
  machineProfileId?: string;
  toolProfileId?: string;
  operationCategory: OperationCategory;
  /** Ve kterých jednotkách je `condition.parameters.feed` - `ToolMachine
   *  Condition` sám tohle nerozlišuje (existující pole je generické, viz
   *  `CuttingParameters` komentář), volající (resolver) ho odvodí z
   *  `operationCategory` (soustružení -> mm/ot, frézování -> mm/zub). */
  feedUnit?: FeedRateUnit;
  ruleVersion: string;
  validFrom: string;
}

/**
 * `CuttingConditionFactory` - staví `CuttingCondition` read-model z existující
 * `ToolMachineCondition` (Krok 5) beze změny té entity/jejího repozitáře.
 * Čistá funkce - žádné I/O.
 */
export class CuttingConditionFactory {
  static fromToolMachineCondition(input: CreateCuttingConditionFromToolMachineConditionInput): CuttingCondition {
    const { condition } = input;
    return CuttingCondition.create({
      id: condition.id,
      tenantId: condition.tenantId,
      materialProfileId: input.materialProfileId,
      machineProfileId: input.machineProfileId,
      toolProfileId: input.toolProfileId,
      operationCategory: input.operationCategory,
      cuttingSpeed: condition.parameters.vc !== undefined ? CuttingSpeed.ofMetersPerMinute(condition.parameters.vc) : undefined,
      feedPerRevolution:
        input.feedUnit === "mm_per_rev" && condition.parameters.feed !== undefined
          ? FeedRate.of(condition.parameters.feed, "mm_per_rev")
          : undefined,
      feedPerTooth:
        input.feedUnit === "mm_per_tooth" && condition.parameters.feed !== undefined
          ? FeedRate.of(condition.parameters.feed, "mm_per_tooth")
          : undefined,
      feedRate:
        input.feedUnit === "mm_per_min" && condition.parameters.feed !== undefined
          ? FeedRate.of(condition.parameters.feed, "mm_per_min")
          : undefined,
      depthOfCut: condition.parameters.ap !== undefined ? Length.ofMillimeters(condition.parameters.ap) : undefined,
      source: condition.source ? SOURCE_MAP[condition.source] : "tool_machine_material",
      priority: condition.priority ?? 0,
      confidence: condition.source === "manufacturer" ? 0.9 : condition.source === "manual" ? 0.95 : 0.7,
      ruleVersion: input.ruleVersion,
      validFrom: input.validFrom,
    });
  }
}
