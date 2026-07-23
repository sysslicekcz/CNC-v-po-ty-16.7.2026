import type { OperationCategory } from "@/domain/calculation-engine/enums/operation-category";
import { CalculationResult } from "@/domain/calculation-engine/entities/calculation-result";
import { CalculationRequest } from "@/domain/calculation-engine/entities/calculation-request";
import { CalculationIssue } from "@/domain/calculation-engine/entities/types";

/**
 * `PlanningTimeInput` (AP-MCE-001 Fáze H §18) - STRUKTUROVANÝ časový model
 * předávaný Planning Engine (§18 "Neposílej pouze jedno číslo 'norma času'").
 * Audit potvrdil, že v projektu ŽÁDNÝ Planning Engine/modul zatím neexistuje
 * (jen rezervované `FeatureCode`, viz `planning.view`/`planning.edit`) - tahle
 * DTO je proto ROZHRANÍ/KONTRAKT, který budoucí Planning modul přijme beze
 * změny tvaru, ne integrace do existujícího kódu (nemá do čeho). §18 "V této
 * fázi neupravuj plánovací algoritmus více, než je nutné pro přijetí
 * strukturovaného vstupu" - tady se proto zastavuje na definici + sestavení
 * DTO z `CalculationResult`/`CalculationRequest`, žádný plánovací algoritmus
 * v projektu není.
 */
export interface PlanningTimeInput {
  calculationId: string;
  calculationRevision: number;
  operationCategory: OperationCategory;
  setupTimeMin: number;
  batchFixedTimeMin: number;
  unitMachineTimeMin: number;
  unitOperatorTimeMin: number;
  unitHandlingTimeMin: number;
  unitInspectionTimeMin: number;
  toolChangeTimeMin: number;
  fixtureChangeTimeMin: number;
  quantity: number;
  /** §18 "překryvy" - odvozeno z `TimeOverlapResolver` typů (Fáze G) POUZE
   *  jako popisné štítky pro Planning Engine; dokud operace neproběhla
   *  (žádný `ActualTimeSegment` neexistuje), zůstává prázdné pole - nejde o
   *  chybějící implementaci, ale o to, že před realizací není co popisovat. */
  overlapRules: readonly string[];
  requiredResources: readonly ("machine" | "operator" | "inspection_equipment" | "external_resource")[];
  requiredQualifications: readonly string[];
  machineProfileId: string | null;
  workstationId: string | null;
  inspectionEquipmentIds: readonly string[];
  confidenceScore: number;
  warnings: readonly CalculationIssue[];
  sourceVersion: string;
}

const CATEGORY_REQUIRED_RESOURCES: Record<OperationCategory, readonly ("machine" | "operator" | "inspection_equipment" | "external_resource")[]> = {
  turning: ["machine", "operator"],
  milling: ["machine", "operator"],
  grinding: ["machine", "operator"],
  manual: ["operator"],
  inspection: ["operator", "inspection_equipment"],
  cutting: ["machine", "operator"],
  ndt: ["operator", "inspection_equipment"],
  preparation: ["operator"],
  other: ["operator"],
};

function readStringField(snapshot: Readonly<Record<string, unknown>>, field: string): string | undefined {
  const value = snapshot[field];
  return typeof value === "string" ? value : undefined;
}

function readStringArrayField(snapshot: Readonly<Record<string, unknown>>, field: string): readonly string[] {
  const value = snapshot[field];
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

/**
 * Čistá projekce `CalculationResult` (breakdown) + `CalculationRequest`
 * (inputSnapshot - zdroj `machineId`/`workstationId`/kvalifikací/vybavení) na
 * `PlanningTimeInput`. Vyžaduje `result.breakdown` (tj. `status !== "failed"`).
 */
export function buildPlanningTimeInput(result: CalculationResult, request: CalculationRequest, calculationRevision: number): PlanningTimeInput {
  const breakdown = result.breakdown;
  if (!breakdown) {
    throw new Error(`CalculationResult "${result.id}" nemá breakdown (status "${result.status}") - PlanningTimeInput nelze sestavit.`);
  }
  const snapshot = request.inputSnapshot;
  const inspectionEquipmentIds = readStringArrayField(snapshot, "inspectionEquipmentIds");
  const singleInspectionEquipmentId = readStringField(snapshot, "inspectionEquipmentId");

  return {
    calculationId: result.id,
    calculationRevision,
    operationCategory: request.operationCategory,
    setupTimeMin: breakdown.setupTime.minutes,
    batchFixedTimeMin: breakdown.batchFixedTime.minutes,
    unitMachineTimeMin: breakdown.unitTimeAdjusted.minutes,
    unitOperatorTimeMin: breakdown.handlingTime.minutes,
    unitHandlingTimeMin: breakdown.handlingTime.minutes,
    unitInspectionTimeMin: breakdown.inOperationInspectionTime.minutes,
    toolChangeTimeMin: breakdown.toolChangeTime.minutes * breakdown.plannedToolChanges,
    fixtureChangeTimeMin: breakdown.fixtureChangeTime.minutes * breakdown.plannedFixtureChanges,
    quantity: breakdown.quantity.pieces,
    overlapRules: [],
    requiredResources: CATEGORY_REQUIRED_RESOURCES[request.operationCategory],
    requiredQualifications: readStringArrayField(snapshot, "requiredQualificationIds"),
    machineProfileId: readStringField(snapshot, "machineId") ?? null,
    workstationId: readStringField(snapshot, "workstationId") ?? null,
    inspectionEquipmentIds: singleInspectionEquipmentId ? [singleInspectionEquipmentId, ...inspectionEquipmentIds] : inspectionEquipmentIds,
    confidenceScore: result.confidenceScore ?? 0,
    warnings: result.issues,
    sourceVersion: result.strategyVersion ?? result.engineVersion,
  };
}
