import type { InspectionSubtype, InspectionLevel } from "./inspection-subtype";
import type { InspectionSampleRule } from "./inspection-sample-rule";

/** AP-MCE-001 Fáze F §7 "InspectionFeature" - jeden kontrolovaný znak/skupina
 *  znaků na výrobku, stejná role jako `TurningFeature`/`MillingFeature`/
 *  `GrindingFeature`/`ManualOperationFeature` v předchozích fázích. */
export interface InspectionFeature {
  id: string;
  sequence: number;
  subtype: InspectionSubtype;
  inspectionLevel: InspectionLevel;
  /** Počet měřených charakteristik na JEDEN kus (§7) - škáluje variabilní
   *  čas (§10 `InspectionVariableTime`). */
  characteristicCount?: number;
  /** Chybí-li, použije se operační `samplingPlan`/`sampleSize`/
   *  `samplingFrequency` (§7/§8 "feature override, jinak operation default",
   *  stejný vzor jako `ManualOperationFeature.subtype`). */
  sampleRule?: InspectionSampleRule;
  equipmentId?: string;
  qualificationIds?: string[];
  preparationTimeMin?: number;
  measurementTimePerCharacteristicMin?: number;
  handlingTimeMin?: number;
  documentationTimeMin?: number;
  reportTimeMin?: number;
  cleanupTimeMin?: number;
  repetitionCount?: number;
  notes?: string;
}
