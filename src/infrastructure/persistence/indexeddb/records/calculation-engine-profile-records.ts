import type { MaterialCuttingRecommendationProps } from "@/domain/calculation-engine/profiles/material-cutting-recommendation";
import type { ExternalReferenceSummary } from "@/domain/calculation-engine/shared/external-reference-summary";
import type { MachineWorkEnvelopeProps } from "@/domain/calculation-engine/profiles/machine-work-envelope";
import type { MachineCapabilitySummary } from "@/domain/calculation-engine/shared/machine-capability-summary";
import type { MachineSetupTimeProfileProps } from "@/domain/calculation-engine/profiles/machine-setup-time-profile";
import type { CuttingParametersProps } from "@/domain/value-objects/cutting-parameters";
import type { ToolWearCurvePoint } from "@/domain/calculation-engine/profiles/tool-wear-curve";
import type { OperationCategory } from "@/domain/calculation-engine/enums/operation-category";

/**
 * IndexedDB záznamy pro MaterialProfile/MachineProfile/ToolProfile/
 * CuttingCondition + jejich Correction (AP-MCE-001 Fáze B §8/§10) - stejná
 * konvence jako `calculation-engine-records.ts` (Fáze A): ploché,
 * serializovatelné tvary, mapování dělá `infrastructure/calculation-engine/
 * profile-mappers.ts`. Tvar každého záznamu odpovídá `XProfile.toPlainObject()`
 * výstupu 1:1.
 */
export interface MaterialProfileRecord {
  id: string;
  tenantId: string;
  siteId?: string;
  sourceType: string;
  name: string;
  standard?: string;
  designation?: string;
  materialGroupId: string;
  materialGroupName: string;
  hardness?: number;
  hardnessScale?: string;
  tensileStrengthMpa?: number;
  densityKgM3?: number;
  machinabilityIndex?: number;
  materialCoefficient: number;
  recommendedCuttingSpeeds: MaterialCuttingRecommendationProps[];
  recommendedFeeds: MaterialCuttingRecommendationProps[];
  suitableToolTypeIds: string[];
  notes?: string;
  dataSource: string;
  externalReferences: ExternalReferenceSummary[];
  recordVersion: number;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface MaterialCorrectionRecord {
  id: string;
  tenantId: string;
  materialProfileId: string;
  materialCoefficient?: number;
  recommendedCuttingSpeeds?: MaterialCuttingRecommendationProps[];
  recommendedFeeds?: MaterialCuttingRecommendationProps[];
  notes?: string;
  reason: string;
  createdBy?: string;
  recordVersion: number;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface MachineProfileRecord {
  id: string;
  tenantId: string;
  siteId?: string;
  externalReferences: ExternalReferenceSummary[];
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  machineCategory?: string;
  controlSystem?: string;
  logicalWorkstationId?: string;
  physicalMachineId: string;
  maxRpm?: number;
  minRpm?: number;
  maxPowerKw?: number;
  maxTorqueNm?: number;
  workEnvelope?: MachineWorkEnvelopeProps;
  maxPartDimensions?: MachineWorkEnvelopeProps;
  maxPartWeightKg?: number;
  axisCount?: number;
  toolMagazineCapacity?: number;
  toolChangeTimeSec?: number;
  rapidTraverseRateMmMin?: number;
  accelerationMmSec2?: number;
  positioningAccuracyMm?: number;
  availableFunctions: MachineCapabilitySummary[];
  powerCoefficient: number;
  ageCoefficient: number;
  conditionCoefficient: number;
  typicalSetupTimes: MachineSetupTimeProfileProps[];
  tenantCorrectionId?: string;
  calibrationProfileId?: string;
  recordVersion: number;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface MachineCorrectionRecord {
  id: string;
  tenantId: string;
  machineProfileId: string;
  powerCoefficient?: number;
  ageCoefficient?: number;
  conditionCoefficient?: number;
  typicalSetupTimes?: MachineSetupTimeProfileProps[];
  reason: string;
  createdBy?: string;
  recordVersion: number;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface ToolCuttingParametersRecord {
  operationCategory: OperationCategory;
  operationSubtype?: string;
  parameters: CuttingParametersProps;
}

export interface ToolProfileRecord {
  id: string;
  tenantId: string;
  siteId?: string;
  externalReferences: ExternalReferenceSummary[];
  manufacturer?: string;
  toolTypeId: string;
  toolTypeName: string;
  catalogDesignation?: string;
  toolMaterial?: string;
  geometry?: string;
  diameterMm?: number;
  lengthMm?: number;
  usableLengthMm?: number;
  teethCount?: number;
  cornerRadiusMm?: number;
  insertType?: string;
  suitableMaterialGroupIds: string[];
  supportedOperationCategories: OperationCategory[];
  defaultCuttingParameters: ToolCuttingParametersRecord[];
  toolLife: { pieceLimitPieces?: number; timeLimitMinutes?: number };
  toolChangeTimeSec?: number;
  price?: number;
  currency?: string;
  wearFactorCurve: { points: ToolWearCurvePoint[]; curveVersion: string };
  tenantCorrectionId?: string;
  recordVersion: number;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface ToolCorrectionRecord {
  id: string;
  tenantId: string;
  toolProfileId: string;
  toolLife?: { pieceLimitPieces?: number; timeLimitMinutes?: number };
  wearFactorCurve?: { points: ToolWearCurvePoint[]; curveVersion: string };
  toolChangeTimeSec?: number;
  defaultCuttingParameters?: ToolCuttingParametersRecord[];
  reason: string;
  createdBy?: string;
  recordVersion: number;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface CuttingConditionRecord {
  id: string;
  tenantId: string;
  materialProfileId: string;
  machineProfileId?: string;
  toolProfileId?: string;
  operationCategory: string;
  operationSubtype?: string;
  cuttingSpeed?: number;
  feedPerRevolution?: { value: number; unit: string };
  feedPerTooth?: { value: number; unit: string };
  feedRate?: { value: number; unit: string };
  depthOfCut?: number;
  widthOfCut?: number;
  spindleSpeed?: number;
  coolantMode?: string;
  source: string;
  priority: number;
  confidence: number;
  ruleVersion: string;
  validFrom: string;
  validTo?: string;
}
