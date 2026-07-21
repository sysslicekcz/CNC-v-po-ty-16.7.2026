import { OperationCalculationInputBase } from "../contracts/operation-calculation-input";
import { GrindingFeature } from "./grinding-feature";

/**
 * Vstup brusírenské operace (AP-MCE-001 Fáze E §2) - ADITIVNÍ rozšíření
 * existujícího `OperationCalculationInputBase` (Fáze A), stejný vzor jako
 * Fáze C/D. SDÍLENÝ tvar pro OBĚ rodiny (válcová i rovinná) - který konkrétní
 * `CalculationStrategy` operaci zpracuje určuje `features[].subtype`
 * (`GrindingCalculationStrategy` dispatcher, viz jeho komentář), ne dva
 * odlišné vstupní typy.
 */
export interface GrindingCalculationInput extends OperationCalculationInputBase {
  workstationId?: string;
  batchSize?: number;
  setupTimeMin?: number;
  handlingTimePerPieceMin?: number;
  measurementTimePerPieceMin?: number;
  firstPieceInspectionTimeMin?: number;
  finalInspectionTimeMin?: number;
  fixedAllowanceMin?: number;
  percentageAllowance?: number;
  operatorSkillCoefficient?: number;
  complexityCoefficient?: number;
  calibrationProfileId?: string;
  ruleVersionId?: string;
  clampingCount?: number;
  fixtureChangeCount?: number;
  /** Výchozí `ToolProfile.id` broušecího kotouče pro celou operaci - featury
   *  ho smí přepsat vlastním `wheelProfileId` (stejný vzor jako `machineId`
   *  na úrovni operace vs. per-feature přepis u Fáze C/D nástrojů). */
  wheelProfileId?: string;
  coolantMode?: string;
  notes?: string;

  /** Brusné úseky operace, v pořadí zpracování (§3) - musí obsahovat aspoň
   *  jeden. */
  features: GrindingFeature[];
}
