import { OperationCalculationInputBase } from "../contracts/operation-calculation-input";
import { TurningFeature } from "./turning-feature";

/**
 * Vstup soustružnické operace (AP-MCE-001 Fáze C §2) - ADITIVNÍ rozšíření
 * existujícího `OperationCalculationInputBase` (Fáze A), přesně podle
 * poznámky u toho rozhraní ("Rozšíření pro konkrétní kategorie... přibudou
 * jako DALŠÍ, volitelná pole až s konkrétními strategiemi") - `Calculation
 * StrategyRegistry`/`DefaultCalculationEngine` (Fáze A) se NEMĚNÍ, pořád
 * pracují jen s `OperationCalculationInputBase`; `TurningCalculationStrategy`
 * přetypuje/ověří `TurningCalculationInput` tvar sama v `validate()`.
 *
 * §2 dělí pole na "Společná" (tady, na úrovni CELÉ operace) a "Technologická"
 * (na úrovni JEDNOHO `TurningFeature` - viz `TurningFeature` pro plné
 * zdůvodnění, proč `startDiameterMm`/`cuttingSpeedMMin`/`passCount`/...
 * NEJSOU tady, ale v `features[].geometry`/`cuttingConditionOverride`/
 * `passStrategy`).
 */
export interface TurningCalculationInput extends OperationCalculationInputBase {
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

  /** Technologické úseky operace, v pořadí zpracování (§3) - musí obsahovat
   *  aspoň jeden. */
  features: TurningFeature[];
}
