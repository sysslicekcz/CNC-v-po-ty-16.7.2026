import { ValidationError } from "@/domain/errors/validation-error";
import { EntityStav } from "@/domain/entities/common";
import { ActivityKind } from "@/domain/aggregates/routing-sheet/types";
import { RoutingSheetStav } from "@/domain/aggregates/routing-sheet/routing-sheet";
import { OperationCategory, OperationTypeResourceRequirement } from "@/domain/entities/operation-type";
import { MachiningMode, CuttingConditionSource } from "@/domain/entities/tool-machine-condition";
import { ToolCategory, ToolParameterValueType } from "@/domain/entities/tool-type";
import { CapabilityValueType } from "@/domain/entities/capability-type";
import { CapabilityRequirementKind } from "@/domain/entities/operation-type-capability-requirement";
import { MasterDataStatus } from "@/domain/entities/master-data-status";
import { Address } from "@/domain/value-objects/address";
import { Quantity } from "@/domain/value-objects/quantity";
import { HourlyRate } from "@/domain/value-objects/hourly-rate";
import { Money } from "@/domain/value-objects/money";
import { CuttingParameters } from "@/domain/value-objects/cutting-parameters";
import { SortKey } from "@/domain/value-objects/sort-key";
import { AddressRecord, QuantityRecord, HourlyRateRecord, CuttingParametersRecord, MoneyRecord } from "../records";

/**
 * Sdílené pomocníky pro mappery Record <-> Domain. Mappery nedělají business
 * rozhodnutí ani tichý fallback - neplatná persistence data vždy vyhodí
 * ValidationError (zadání, bod 19), volající (repository/migrace) si chybu
 * převede na migrační issue nebo ji nechá probublat.
 */

export interface LegacyStamp {
  legacySource?: string;
  legacyId?: string;
  migrationRunId?: string;
}

function parseEnum<T extends string>(value: string, allowed: readonly T[], context: string): T {
  if (!allowed.includes(value as T)) {
    throw new ValidationError(`${context}: neplatná hodnota "${value}" (očekáváno jedno z: ${allowed.join(", ")}).`);
  }
  return value as T;
}

/** Veřejná varianta pro mappery entit mimo tenhle soubor (Tenant/CapacityGroup/
 *  ExternalOperationResource/Machine/License status pole), aby si nemusely
 *  psát vlastní kopii stejné validace. */
export function parseEntityStavLike<T extends string>(value: string, allowed: readonly T[], context: string): T {
  return parseEnum(value, allowed, context);
}

const ENTITY_STAV_VALUES = ["aktivni", "neaktivni"] as const;
export function parseEntityStav(value: string, context: string): EntityStav {
  return parseEnum(value, ENTITY_STAV_VALUES, context);
}

const ACTIVITY_KIND_VALUES = ["calculation", "manual", "inspection", "ndt", "external"] as const;
export function parseActivityKind(value: string): ActivityKind {
  return parseEnum(value, ACTIVITY_KIND_VALUES, "Activity.kind");
}

const ROUTING_SHEET_STAV_VALUES = ["draft", "released", "archived"] as const;
export function parseRoutingSheetStav(value: string): RoutingSheetStav {
  return parseEnum(value, ROUTING_SHEET_STAV_VALUES, "RoutingSheet.stav");
}

const OPERATION_CATEGORY_VALUES = [
  "turning",
  "milling",
  "grinding",
  "cutting",
  "inspection",
  "ndt",
  "preparation",
  "manual",
  "other",
] as const;
export function parseOperationCategory(value: string): OperationCategory {
  return parseEnum(value, OPERATION_CATEGORY_VALUES, "OperationType.kategorie");
}

const MACHINING_MODE_VALUES = ["roughing", "finishing", "universal"] as const;
export function parseMachiningMode(value: string | undefined): MachiningMode | undefined {
  if (value === undefined) return undefined;
  return parseEnum(value, MACHINING_MODE_VALUES, "ToolMachineCondition.machiningMode");
}

const CUTTING_CONDITION_SOURCE_VALUES = ["manufacturer", "internal", "calculated", "manual"] as const;
export function parseCuttingConditionSource(value: string | undefined): CuttingConditionSource | undefined {
  if (value === undefined) return undefined;
  return parseEnum(value, CUTTING_CONDITION_SOURCE_VALUES, "ToolMachineCondition.source");
}

const OPERATION_TYPE_RESOURCE_REQUIREMENT_VALUES = ["machine", "external", "either", "none"] as const;
export function parseOperationTypeResourceRequirement(value: string): OperationTypeResourceRequirement {
  return parseEnum(value, OPERATION_TYPE_RESOURCE_REQUIREMENT_VALUES, "OperationType.resourceRequirement");
}

const TOOL_CATEGORY_VALUES = [
  "turning_holder",
  "turning_insert",
  "milling_cutter",
  "milling_insert",
  "drill",
  "tap",
  "reamer",
  "grinding_wheel",
  "measuring_tool",
  "other",
] as const;
export function parseToolCategory(value: string): ToolCategory {
  return parseEnum(value, TOOL_CATEGORY_VALUES, "ToolType.category");
}

const TOOL_PARAMETER_VALUE_TYPE_VALUES = ["number", "text", "boolean", "selection"] as const;
export function parseToolParameterValueType(value: string): ToolParameterValueType {
  return parseEnum(value, TOOL_PARAMETER_VALUE_TYPE_VALUES, "ToolParameterDefinition.valueType");
}

const CAPABILITY_VALUE_TYPE_VALUES = ["boolean", "number", "text", "selection"] as const;
export function parseCapabilityValueType(value: string): CapabilityValueType {
  return parseEnum(value, CAPABILITY_VALUE_TYPE_VALUES, "CapabilityType.valueType");
}

const CAPABILITY_REQUIREMENT_KIND_VALUES = ["required", "recommended"] as const;
export function parseCapabilityRequirementKind(value: string): CapabilityRequirementKind {
  return parseEnum(value, CAPABILITY_REQUIREMENT_KIND_VALUES, "OperationTypeCapabilityRequirement.requirement");
}

const MASTER_DATA_STATUS_VALUES = ["active", "inactive"] as const;
export function parseMasterDataStatus(value: string): MasterDataStatus {
  return parseEnum(value, MASTER_DATA_STATUS_VALUES, "MasterDataStatus");
}

export function addressToRecord(address?: Address): AddressRecord | undefined {
  return address ? { ulice: address.ulice, mesto: address.mesto, psc: address.psc, zeme: address.zeme } : undefined;
}
export function addressFromRecord(record?: AddressRecord): Address | undefined {
  return record ? Address.of(record) : undefined;
}

export function quantityToRecord(quantity: Quantity): QuantityRecord {
  return { value: quantity.value, unit: quantity.unit };
}
export function quantityFromRecord(record: QuantityRecord): Quantity {
  return Quantity.of(record.value, record.unit);
}

export function hourlyRateToRecord(rate: HourlyRate): HourlyRateRecord {
  return { amount: rate.amount, currency: rate.currency };
}
export function hourlyRateFromRecord(record: HourlyRateRecord): HourlyRate {
  return HourlyRate.fromMoney(Money.of(record.amount, record.currency));
}

export function cuttingParametersToRecord(params?: CuttingParameters): CuttingParametersRecord | undefined {
  return params ? { vc: params.vc, feed: params.feed, ap: params.ap } : undefined;
}
export function cuttingParametersFromRecord(record?: CuttingParametersRecord): CuttingParameters | undefined {
  return record ? CuttingParameters.of(record) : undefined;
}

export function moneyToRecord(money?: Money): MoneyRecord | undefined {
  return money ? { amount: money.amount, currency: money.currency } : undefined;
}
export function moneyFromRecord(record?: MoneyRecord): Money | undefined {
  return record ? Money.of(record.amount, record.currency) : undefined;
}

export function sortKeyToRecord(sortKey: SortKey): string {
  return sortKey.toString();
}
export function sortKeyFromRecord(value: string): SortKey {
  return SortKey.of(value);
}
