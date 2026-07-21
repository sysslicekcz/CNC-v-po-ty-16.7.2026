import { OperationCalculationInputBase } from "../contracts/operation-calculation-input";
import type { InspectionSubtype, InspectionLevel } from "./inspection-subtype";
import type { InspectionSamplingMode } from "./inspection-sampling-strategy";
import type { InspectionFeature } from "./inspection-feature";

/**
 * Vstup pro `InspectionCalculationStrategy` (AP-MCE-001 Fáze F §6) - rozšiřuje
 * sdílený `OperationCalculationInputBase` (Fáze A), stejný vzor jako Turning/
 * Milling/Grinding/Manual. `tenantId`/`siteId` VĚDOMĚ chybí ze stejného
 * důvodu jako u `ManualOperationCalculationInput` - tenant se v celé
 * platformě resolvuje výhradně přes `TenantContext.requireCurrentTenantId()`
 * na Application vrstvě (`CalculateInspectionOperationUseCase`), nikdy jako
 * doménové vstupní pole; přidání by tu bylo nekonzistentní architektonickou
 * odchylkou (stejné zdůvodnění napříč celou Fází F).
 */
export interface InspectionCalculationInput extends OperationCalculationInputBase {
  workstationId?: string;
  inspectionSubtype?: InspectionSubtype;
  inspectionLevel?: InspectionLevel;

  /** §6 "samplingPlan" - výchozí režim vzorkování pro celou operaci,
   *  `features[].sampleRule` má přednost, pokud je vyplněné (§8). */
  samplingPlan?: InspectionSamplingMode;
  sampleSize?: number;
  samplingFrequency?: number;

  /** §6 - které úrovně kontroly operace zahrnuje (informativní/řídicí příznaky,
   *  konkrétní čas nesou `features[].inspectionLevel`/`sampleRule`). */
  firstPieceInspection?: boolean;
  inProcessInspection?: boolean;
  finalInspection?: boolean;

  /** §6 "inspectionEquipmentIds" - výchozí dostupné vybavení pro operaci,
   *  `features[].equipmentId` má přednost, pokud je vyplněné. */
  inspectionEquipmentIds?: string[];
  requiredQualificationIds?: string[];

  preparationTimeMin?: number;
  setupTimeMin?: number;
  measurementTimePerCharacteristicMin?: number;
  /** §6 "characteristicCount" - výchozí počet měřených charakteristik na kus
   *  pro operaci, `features[].characteristicCount` má přednost. */
  characteristicCount?: number;
  partHandlingTimeMin?: number;
  documentationTimeMin?: number;
  reportTimeMin?: number;
  cleanupTimeMin?: number;

  /** §11 CMM/automatizovaná kontrola - musí zůstat oddělené od obecného
   *  `preparationTimeMin`/`measurementTimePerCharacteristicMin`, aby šel
   *  strojní cyklus počítat samostatně od obsluhy (kapacitní plánování). */
  programCreationTimeMin?: number;
  programLoadTimeMin?: number;
  fixtureSetupTimeMin?: number;
  automaticCycleTimePerCharacteristicMin?: number;
  operatorAttendanceTimePerCharacteristicMin?: number;
  evaluationTimePerCharacteristicMin?: number;

  fixedAllowanceMin?: number;
  percentageAllowance?: number;

  /** §13 sedm pojmenovaných koeficientů - viz `inspection-coefficients.ts`. */
  complexityCoefficient?: number;
  accuracyCoefficient?: number;
  equipmentCoefficient?: number;
  operatorSkillCoefficient?: number;
  documentationCoefficient?: number;
  automationCoefficient?: number;
  historicalCalibrationCoefficient?: number;

  calibrationProfileId?: string;
  ruleVersionId?: string;
  notes?: string;

  features?: InspectionFeature[];
}
