import { InspectionEquipmentProfileSnapshot } from "./inspection-equipment-profile-snapshot";
import type { EquipmentType, AutomationLevel, ReportGenerationMode } from "./inspection-equipment-profile";
import type { InspectionSubtype } from "./inspection-subtype";

/** Typovaný "pohled" na `InspectionEquipmentProfileSnapshot.resolvedData`
 *  (AP-MCE-001 Fáze F §9) - stejný důvod jako `manual-context-views.ts`,
 *  JEDINÉ místo, které z plochého tvaru čte konkrétní, typovaná pole. */
export interface InspectionEquipmentView {
  equipmentType: EquipmentType;
  supportedInspectionSubtypes: readonly InspectionSubtype[];
  accuracy?: number;
  setupTimeMin: number;
  calibrationValidTo?: string;
  equipmentCoefficient: number;
  automationLevel: AutomationLevel;
  reportGenerationMode: ReportGenerationMode;
}

export function readInspectionEquipmentView(snapshot: InspectionEquipmentProfileSnapshot): InspectionEquipmentView {
  const data = snapshot.resolvedData as Record<string, unknown>;
  return {
    equipmentType: data.equipmentType as EquipmentType,
    supportedInspectionSubtypes: (data.supportedInspectionSubtypes as InspectionSubtype[] | undefined) ?? [],
    accuracy: data.accuracy as number | undefined,
    setupTimeMin: data.setupTimeMin as number,
    calibrationValidTo: data.calibrationValidTo as string | undefined,
    equipmentCoefficient: data.equipmentCoefficient as number,
    automationLevel: data.automationLevel as AutomationLevel,
    reportGenerationMode: data.reportGenerationMode as ReportGenerationMode,
  };
}
