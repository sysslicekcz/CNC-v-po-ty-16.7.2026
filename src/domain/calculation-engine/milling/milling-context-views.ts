import { MaterialProfileSnapshot } from "../profiles/material-profile-snapshot";
import { MachineProfileSnapshot } from "../profiles/machine-profile-snapshot";
import { ToolProfileSnapshot } from "../profiles/tool-profile-snapshot";
import type { OperationCategory } from "../enums/operation-category";

/**
 * Typované "pohledy" na `resolvedData` profilových snapshotů (AP-MCE-001
 * Fáze D §1/§6) - `MillingCalculationStrategy` je ČISTÁ (žádný přístup k
 * repozitáři), dostává jen NEŽIVÁ, zamrazená data přes `CalculationContext`.
 * Vlastní kopie Fáze C `turning-context-views.ts` (stejný důvod jako
 * `milling/tool-change-accounting.ts` - žádná křížová závislost mezi
 * technologickými moduly). JEDINÉ místo, které z plochého tvaru čte
 * konkrétní, typovaná pole - strategie sama žádné `as` přetypování nedělá.
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
  axisCount?: number;
  rapidTraverseRateMmMin?: number;
  maxFeedRateMmMin?: number;
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
    axisCount: data.axisCount as number | undefined,
    rapidTraverseRateMmMin: data.rapidTraverseRateMmMin as number | undefined,
    maxFeedRateMmMin: data.maxFeedRateMmMin as number | undefined,
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
  lengthMm?: number;
  usableLengthMm?: number;
  teethCount?: number;
  suitableMaterialGroupIds: string[];
  supportedOperationCategories: OperationCategory[];
  toolLife: { pieceLimitPieces?: number; timeLimitMinutes?: number };
  wearFactorCurve: { points: Array<{ pieceIndex: number; wearFactor: number }>; curveVersion: string };
  toolChangeTimeSec?: number;
  maxCuttingSpeedMMin?: number;
  maxFeedPerToothMm?: number;
}

export function readToolProfileView(snapshot: ToolProfileSnapshot): ToolProfileView {
  const data = snapshot.resolvedData as Record<string, unknown>;
  return {
    id: data.id as string,
    diameterMm: data.diameterMm as number | undefined,
    lengthMm: data.lengthMm as number | undefined,
    usableLengthMm: data.usableLengthMm as number | undefined,
    teethCount: data.teethCount as number | undefined,
    suitableMaterialGroupIds: (data.suitableMaterialGroupIds as string[] | undefined) ?? [],
    supportedOperationCategories: (data.supportedOperationCategories as OperationCategory[] | undefined) ?? [],
    toolLife: data.toolLife as { pieceLimitPieces?: number; timeLimitMinutes?: number },
    wearFactorCurve: data.wearFactorCurve as { points: Array<{ pieceIndex: number; wearFactor: number }>; curveVersion: string },
    toolChangeTimeSec: data.toolChangeTimeSec as number | undefined,
    maxCuttingSpeedMMin: data.maxCuttingSpeedMMin as number | undefined,
    maxFeedPerToothMm: data.maxFeedPerToothMm as number | undefined,
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
