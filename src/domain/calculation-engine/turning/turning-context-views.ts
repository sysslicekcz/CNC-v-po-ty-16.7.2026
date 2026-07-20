import { MaterialProfileSnapshot } from "../profiles/material-profile-snapshot";
import { MachineProfileSnapshot } from "../profiles/machine-profile-snapshot";
import { ToolProfileSnapshot } from "../profiles/tool-profile-snapshot";
import { CuttingConditionSnapshot } from "../cutting-conditions/cutting-condition-snapshot";
import type { OperationCategory } from "../enums/operation-category";

/**
 * Typované "pohledy" na `resolvedData` profilových snapshotů (AP-MCE-001
 * Fáze C §1/§6) - `TurningCalculationStrategy` je ČISTÁ (žádný přístup k
 * repozitáři, viz `CalculationStrategy` komentář), dostává jen NEŽIVÁ,
 * zamrazená data přes `CalculationContext.materialProfileSnapshot/
 * machineProfileSnapshot/toolProfileSnapshot/cuttingConditionSnapshot`
 * (`ProfileSnapshot.resolvedData: Record<string, unknown>` - plochý výstup
 * `XProfile.toPlainObject()`, ne živá instance s metodami). Tenhle soubor je
 * JEDINÉ místo, které z toho plochého tvaru čte konkrétní, typovaná pole -
 * strategie sama žádné `as` přetypování nedělá.
 */

export interface WorkEnvelopeView {
  maxLengthMm?: number;
  maxWidthMm?: number;
  maxHeightMm?: number;
  maxDiameterMm?: number;
}

export interface MachineProfileView {
  id: string;
  physicalMachineId: string;
  machineCategory?: string;
  maxRpm?: number;
  minRpm?: number;
  maxPowerKw?: number;
  maxTorqueNm?: number;
  maxPartWeightKg?: number;
  workEnvelope?: WorkEnvelopeView;
  maxPartDimensions?: WorkEnvelopeView;
  availableFunctionCodes: string[];
  powerCoefficient: number;
  ageCoefficient: number;
  conditionCoefficient: number;
  performanceCoefficient: number;
}

export function readMachineProfileView(snapshot: MachineProfileSnapshot): MachineProfileView {
  const data = snapshot.resolvedData as Record<string, unknown>;
  const availableFunctions = (data.availableFunctions as Array<{ capabilityTypeCode: string }> | undefined) ?? [];
  return {
    id: data.id as string,
    physicalMachineId: data.physicalMachineId as string,
    machineCategory: data.machineCategory as string | undefined,
    maxRpm: data.maxRpm as number | undefined,
    minRpm: data.minRpm as number | undefined,
    maxPowerKw: data.maxPowerKw as number | undefined,
    maxTorqueNm: data.maxTorqueNm as number | undefined,
    maxPartWeightKg: data.maxPartWeightKg as number | undefined,
    workEnvelope: data.workEnvelope as WorkEnvelopeView | undefined,
    maxPartDimensions: data.maxPartDimensions as WorkEnvelopeView | undefined,
    availableFunctionCodes: availableFunctions.map((f) => f.capabilityTypeCode),
    powerCoefficient: data.powerCoefficient as number,
    ageCoefficient: data.ageCoefficient as number,
    conditionCoefficient: data.conditionCoefficient as number,
    performanceCoefficient: data.performanceCoefficient as number,
  };
}

export interface ToolProfileView {
  id: string;
  diameterMm?: number;
  suitableMaterialGroupIds: string[];
  supportedOperationCategories: OperationCategory[];
  toolLife: { pieceLimitPieces?: number; timeLimitMinutes?: number };
  wearFactorCurve: { points: Array<{ pieceIndex: number; wearFactor: number }>; curveVersion: string };
  toolChangeTimeSec?: number;
  maxCuttingSpeedMMin?: number;
}

export function readToolProfileView(snapshot: ToolProfileSnapshot): ToolProfileView {
  const data = snapshot.resolvedData as Record<string, unknown>;
  return {
    id: data.id as string,
    diameterMm: data.diameterMm as number | undefined,
    suitableMaterialGroupIds: (data.suitableMaterialGroupIds as string[] | undefined) ?? [],
    supportedOperationCategories: (data.supportedOperationCategories as OperationCategory[] | undefined) ?? [],
    toolLife: data.toolLife as { pieceLimitPieces?: number; timeLimitMinutes?: number },
    wearFactorCurve: data.wearFactorCurve as { points: Array<{ pieceIndex: number; wearFactor: number }>; curveVersion: string },
    toolChangeTimeSec: data.toolChangeTimeSec as number | undefined,
    maxCuttingSpeedMMin: data.maxCuttingSpeedMMin as number | undefined,
  };
}

export interface MaterialProfileView {
  id: string;
  materialGroupId: string;
  materialCoefficient: number;
}

export function readMaterialProfileView(snapshot: MaterialProfileSnapshot): MaterialProfileView {
  const data = snapshot.resolvedData as Record<string, unknown>;
  return {
    id: data.id as string,
    materialGroupId: data.materialGroupId as string,
    materialCoefficient: data.materialCoefficient as number,
  };
}

export interface CuttingConditionView {
  cuttingSpeedMMin?: number;
  cuttingSpeedSource?: string;
  cuttingSpeedConfidence?: number;
  feedPerRevolutionMm?: number;
  feedSource?: string;
  feedConfidence?: number;
}

export function readCuttingConditionView(snapshot: CuttingConditionSnapshot): CuttingConditionView {
  const data = snapshot.resolvedData as {
    cuttingSpeed?: { metersPerMinute: number; source: string; confidence: number };
    feed?: { value: number; unit: string; source: string; confidence: number };
  };
  return {
    cuttingSpeedMMin: data.cuttingSpeed?.metersPerMinute,
    cuttingSpeedSource: data.cuttingSpeed?.source,
    cuttingSpeedConfidence: data.cuttingSpeed?.confidence,
    feedPerRevolutionMm: data.feed?.unit === "mm_per_rev" ? data.feed.value : undefined,
    feedSource: data.feed?.source,
    feedConfidence: data.feed?.confidence,
  };
}
