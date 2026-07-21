import { MaterialProfileSnapshot } from "../profiles/material-profile-snapshot";
import { MachineProfileSnapshot } from "../profiles/machine-profile-snapshot";
import { ToolProfileSnapshot } from "../profiles/tool-profile-snapshot";
import type { OperationCategory } from "../enums/operation-category";

/**
 * Typované "pohledy" na `resolvedData` profilových snapshotů (AP-MCE-001
 * Fáze E §1/§9) - stejný důvod a vzor jako Fáze C/D `*-context-views.ts`
 * (vlastní kopie, žádná křížová závislost mezi technologickými moduly).
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
  /** §9 "machine stiffness nebo precision capability, pokud je dostupná" -
   *  znovupoužití existujícího `MachineProfile.positioningAccuracyMm` (Fáze
   *  B, mm) jako proxy pro dosažitelnou přesnost stroje. */
  positioningAccuracyMm?: number;
  rapidTraverseRateMmMin?: number;
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
    positioningAccuracyMm: data.positioningAccuracyMm as number | undefined,
    rapidTraverseRateMmMin: data.rapidTraverseRateMmMin as number | undefined,
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
  widthMm?: number;
  suitableMaterialGroupIds: string[];
  supportedOperationCategories: OperationCategory[];
  toolLife: { pieceLimitPieces?: number; timeLimitMinutes?: number; volumeLimitMm3?: number };
  wearFactorCurve: { points: Array<{ pieceIndex: number; wearFactor: number }>; curveVersion: string };
  toolChangeTimeSec?: number;
  maxCuttingSpeedMMin?: number;
}

export function readToolProfileView(snapshot: ToolProfileSnapshot): ToolProfileView {
  const data = snapshot.resolvedData as Record<string, unknown>;
  return {
    id: data.id as string,
    diameterMm: data.diameterMm as number | undefined,
    widthMm: data.widthMm as number | undefined,
    suitableMaterialGroupIds: (data.suitableMaterialGroupIds as string[] | undefined) ?? [],
    supportedOperationCategories: (data.supportedOperationCategories as OperationCategory[] | undefined) ?? [],
    toolLife: data.toolLife as { pieceLimitPieces?: number; timeLimitMinutes?: number; volumeLimitMm3?: number },
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
