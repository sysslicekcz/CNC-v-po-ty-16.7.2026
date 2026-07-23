import { GenericCalculationDraftData, StrategyFormFieldContracts } from "./form-field-contract";
import { parseGroupFields, parseOperationFields, undefinedIfEmpty } from "./form-field-parsing";
import { TurningCalculationInput } from "@/domain/calculation-engine/turning/turning-calculation-input";
import { TurningFeature } from "@/domain/calculation-engine/turning/turning-feature";
import { MillingCalculationInput } from "@/domain/calculation-engine/milling/milling-calculation-input";
import { MillingFeature } from "@/domain/calculation-engine/milling/milling-feature";
import { GrindingCalculationInput } from "@/domain/calculation-engine/grinding/grinding-calculation-input";
import { GrindingFeature } from "@/domain/calculation-engine/grinding/grinding-feature";
import { ManualOperationCalculationInput } from "@/domain/calculation-engine/manual/manual-operation-calculation-input";
import { ManualOperationFeature } from "@/domain/calculation-engine/manual/manual-operation-feature";
import { InspectionCalculationInput } from "@/domain/calculation-engine/inspection/inspection-calculation-input";
import { InspectionFeature } from "@/domain/calculation-engine/inspection/inspection-feature";

/**
 * Mapování plochého UI stavu (`GenericCalculationDraftData`, viz
 * `CalculationFormRegistry` v presentation vrstvě) na doménový vstup
 * KONKRÉTNÍ strategie (AP-MCE-001 Fáze H §5 "Každý formulář musí mapovat UI
 * DTO na application DTO. Doménové entity nepoužívej jako mutable form
 * state."). Žije v Application vrstvě (ne presentation), protože importuje
 * doménové vstupní typy přímo (`TurningCalculationInput` apod.) - podle
 * architektonických testů Fáze C-F smí `domain/calculation-engine/<strategie>`
 * importovat jen domain a application, nikdy UI (§17 "kontrola licence i tady,
 * NE jen v UI" - stejný princip, aplikovaný na dependency směr).
 */

function baseFields(draft: GenericCalculationDraftData) {
  return {
    operationCategory: undefined as never, // doplní konkrétní builder
    operationTypeId: draft.operationTypeId,
    quantity: Number(draft.quantity) || 0,
    materialId: draft.materialId,
    machineId: draft.machineId || undefined,
    toolId: draft.toolId || undefined,
  };
}

export function buildTurningInput(draft: GenericCalculationDraftData, contracts: StrategyFormFieldContracts): TurningCalculationInput {
  const features: TurningFeature[] = draft.features.map((f, index) => {
    const geometry = parseGroupFields(f.fields, contracts.featureFields, "geometry", f.subtype);
    const cuttingConditionOverride = undefinedIfEmpty(parseGroupFields(f.fields, contracts.featureFields, "cuttingConditionOverride", f.subtype));
    const passStrategy = undefinedIfEmpty(parseGroupFields(f.fields, contracts.featureFields, "passStrategy", f.subtype));
    const featureExtra = parseGroupFields(f.fields, contracts.featureFields, "feature", f.subtype);
    return {
      id: f.id,
      sequence: index,
      subtype: f.subtype as TurningFeature["subtype"],
      machiningMode: (f.machiningMode ?? "roughing") as TurningFeature["machiningMode"],
      geometry: geometry as unknown as TurningFeature["geometry"],
      cuttingConditionOverride: cuttingConditionOverride as TurningFeature["cuttingConditionOverride"],
      passStrategy: passStrategy as TurningFeature["passStrategy"],
      measurementRequirement: f.measurementRequirement as TurningFeature["measurementRequirement"],
      notes: f.notes,
      ...featureExtra,
    } as TurningFeature;
  });

  const operationExtra = parseOperationFields(draft.operationFields, contracts.operationFields);
  return {
    ...(baseFields(draft) as unknown as TurningCalculationInput),
    operationCategory: "turning",
    features,
    ...operationExtra,
  };
}

export function buildMillingInput(draft: GenericCalculationDraftData, contracts: StrategyFormFieldContracts): MillingCalculationInput {
  const features: MillingFeature[] = draft.features.map((f, index) => {
    const geometry = parseGroupFields(f.fields, contracts.featureFields, "geometry", f.subtype);
    const cuttingConditionOverride = undefinedIfEmpty(parseGroupFields(f.fields, contracts.featureFields, "cuttingConditionOverride", f.subtype));
    const passStrategy = undefinedIfEmpty(parseGroupFields(f.fields, contracts.featureFields, "passStrategy", f.subtype));
    const featureExtra = parseGroupFields(f.fields, contracts.featureFields, "feature", f.subtype);
    const { widthOfCutMm, depthOfCutMm, ...restExtra } = featureExtra as { widthOfCutMm?: number; depthOfCutMm?: number; [k: string]: unknown };
    const toolEngagement = widthOfCutMm !== undefined || depthOfCutMm !== undefined ? { widthOfCutMm, depthOfCutMm } : undefined;
    return {
      id: f.id,
      sequence: index,
      subtype: f.subtype as MillingFeature["subtype"],
      machiningMode: (f.machiningMode ?? "roughing") as MillingFeature["machiningMode"],
      geometry: geometry as unknown as MillingFeature["geometry"],
      cuttingConditionOverride: cuttingConditionOverride as MillingFeature["cuttingConditionOverride"],
      passStrategy: passStrategy as MillingFeature["passStrategy"],
      measurementRequirement: f.measurementRequirement as MillingFeature["measurementRequirement"],
      toolEngagement,
      notes: f.notes,
      ...restExtra,
    } as MillingFeature;
  });

  const operationExtra = parseOperationFields(draft.operationFields, contracts.operationFields);
  return {
    ...(baseFields(draft) as unknown as MillingCalculationInput),
    operationCategory: "milling",
    features,
    ...operationExtra,
  };
}

export function buildGrindingInput(draft: GenericCalculationDraftData, contracts: StrategyFormFieldContracts): GrindingCalculationInput {
  const features: GrindingFeature[] = draft.features.map((f, index) => {
    const geometry = parseGroupFields(f.fields, contracts.featureFields, "geometry", f.subtype);
    const cuttingConditionOverride = undefinedIfEmpty(parseGroupFields(f.fields, contracts.featureFields, "cuttingConditionOverride", f.subtype));
    const passStrategy = undefinedIfEmpty(parseGroupFields(f.fields, contracts.featureFields, "passStrategy", f.subtype));
    const dressingStrategy = undefinedIfEmpty(parseGroupFields(f.fields, contracts.featureFields, "dressingStrategy", f.subtype));
    const featureExtra = parseGroupFields(f.fields, contracts.featureFields, "feature", f.subtype);
    return {
      id: f.id,
      sequence: index,
      subtype: f.subtype as GrindingFeature["subtype"],
      machiningMode: (f.machiningMode ?? "roughing") as GrindingFeature["machiningMode"],
      geometry: geometry as unknown as GrindingFeature["geometry"],
      cuttingConditionOverride: cuttingConditionOverride as GrindingFeature["cuttingConditionOverride"],
      passStrategy: passStrategy as GrindingFeature["passStrategy"],
      dressingStrategy: dressingStrategy as GrindingFeature["dressingStrategy"],
      measurementRequirement: f.measurementRequirement as GrindingFeature["measurementRequirement"],
      notes: f.notes,
      ...featureExtra,
    } as GrindingFeature;
  });

  const operationExtra = parseOperationFields(draft.operationFields, contracts.operationFields);
  return {
    ...(baseFields(draft) as unknown as GrindingCalculationInput),
    operationCategory: "grinding",
    features,
    ...operationExtra,
  };
}

export function buildManualInput(draft: GenericCalculationDraftData, contracts: StrategyFormFieldContracts): ManualOperationCalculationInput {
  const features: ManualOperationFeature[] | undefined =
    draft.features.length > 0
      ? draft.features.map((f, index) => {
          const featureExtra = parseGroupFields(f.fields, contracts.featureFields, "feature", f.subtype);
          return {
            id: f.id,
            sequence: index,
            subtype: f.subtype as ManualOperationFeature["subtype"],
            quantityBasis: "per_piece",
            timeBasis: "explicit",
            notes: f.notes,
            ...featureExtra,
          } as ManualOperationFeature;
        })
      : undefined;

  const operationExtra = parseOperationFields(draft.operationFields, contracts.operationFields);
  return {
    ...(baseFields(draft) as unknown as ManualOperationCalculationInput),
    operationCategory: "manual",
    features,
    baseUnitTimeMin: draft.baseUnitTimeMin !== undefined && draft.baseUnitTimeMin !== "" ? Number(draft.baseUnitTimeMin) : undefined,
    ...operationExtra,
  };
}

export function buildInspectionInput(draft: GenericCalculationDraftData, contracts: StrategyFormFieldContracts): InspectionCalculationInput {
  const features: InspectionFeature[] | undefined =
    draft.features.length > 0
      ? draft.features.map((f, index) => {
          const featureExtra = parseGroupFields(f.fields, contracts.featureFields, "feature", f.subtype);
          return {
            id: f.id,
            sequence: index,
            subtype: f.subtype as InspectionFeature["subtype"],
            inspectionLevel: (f.measurementRequirement ?? "sample") as InspectionFeature["inspectionLevel"],
            notes: f.notes,
            ...featureExtra,
          } as InspectionFeature;
        })
      : undefined;

  const operationExtra = parseOperationFields(draft.operationFields, contracts.operationFields);
  return {
    ...(baseFields(draft) as unknown as InspectionCalculationInput),
    operationCategory: "inspection",
    features,
    ...operationExtra,
  };
}
