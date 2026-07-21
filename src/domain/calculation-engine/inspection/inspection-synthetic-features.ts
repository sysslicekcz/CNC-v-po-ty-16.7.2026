import { InspectionCalculationInput } from "./inspection-calculation-input";
import { InspectionFeature } from "./inspection-feature";

/**
 * Sdílené mezi `InspectionCalculationStrategy` (Domain) a
 * `InspectionCalculationContextBuilder` (Application) - stejný důvod jako
 * `syntheticManualFeatures`: builder potřebuje projít STEJNOU sadu features,
 * aby dokázal rozřešit `InspectionEquipmentProfile` snapshot per feature.id
 * PŘED voláním strategie.
 */
export function syntheticInspectionFeatures(input: InspectionCalculationInput): InspectionFeature[] {
  if (input.features && input.features.length > 0) return input.features;
  return [
    {
      id: "__implicit__",
      sequence: 0,
      subtype: input.inspectionSubtype ?? "custom_inspection",
      inspectionLevel: input.inspectionLevel ?? "in_process",
      sampleRule: input.samplingPlan ? { mode: input.samplingPlan, frequency: input.samplingFrequency, sampleSize: input.sampleSize } : undefined,
      equipmentId: input.inspectionEquipmentIds?.[0],
      characteristicCount: input.characteristicCount ?? 1,
    },
  ];
}
