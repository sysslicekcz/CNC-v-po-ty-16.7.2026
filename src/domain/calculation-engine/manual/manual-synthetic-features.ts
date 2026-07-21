import { ManualOperationCalculationInput } from "./manual-operation-calculation-input";
import { ManualOperationFeature } from "./manual-operation-feature";

/**
 * Sdílené mezi `ManualOperationCalculationStrategy` (Domain) a
 * `ManualOperationCalculationContextBuilder` (Application) - OBĚ potřebují
 * projít STEJNOU sadu features (strategie pro výpočet, builder pro
 * rozřešení `ManualTimeStandard` per feature.id PŘED voláním strategie),
 * jedna sdílená funkce zabraňuje, aby se ty dvě cesty rozešly (§2 "operace
 * bez `features` musí fungovat stejně jako s jedním implicitním").
 */
export function syntheticManualFeatures(input: ManualOperationCalculationInput): ManualOperationFeature[] {
  if (input.features && input.features.length > 0) return input.features;
  return [
    {
      id: "__implicit__",
      sequence: 0,
      subtype: input.manualOperationSubtype ?? "custom_manual",
      quantityBasis: "per_piece",
      timeBasis: "explicit",
      baseTimeMin: input.baseUnitTimeMin ?? 0,
    },
  ];
}
