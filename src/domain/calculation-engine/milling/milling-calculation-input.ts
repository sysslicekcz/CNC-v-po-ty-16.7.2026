import { OperationCalculationInputBase } from "../contracts/operation-calculation-input";
import { MillingFeature } from "./milling-feature";

/**
 * Vstup frézovací operace (AP-MCE-001 Fáze D §2) - ADITIVNÍ rozšíření
 * existujícího `OperationCalculationInputBase` (Fáze A), stejný vzor jako
 * Fáze C `TurningCalculationInput`. §2 dělí pole na "Společná" (tady, na
 * úrovni CELÉ operace) a "Technologická" (na úrovni JEDNOHO `MillingFeature` -
 * viz `MillingFeature`/`MillingFeatureGeometry` pro plné zdůvodnění, proč
 * `toolDiameterMm`/`cuttingSpeedMMin`/`passCount`/`pocketLengthMm`/... NEJSOU
 * tady, ale v `features[].geometry`/`cuttingConditionOverride`/`pathStrategy`/
 * `passStrategy` - jedna operace může kombinovat úseky s různou geometrií a
 * různými nástroji).
 */
export interface MillingCalculationInput extends OperationCalculationInputBase {
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
  /** §2 - počet upnutí CELÉ operace (na rozdíl od `fixtureChangeCount`, což
   *  je počet PŘEUPNUTÍ MEZI upnutími) - víc upnutí (§3 "více upnutí") se
   *  projeví jako `fixtureChangeTimeMin` v breakdownu. */
  clampingCount?: number;
  fixtureChangeCount?: number;
  notes?: string;

  /** Technologické úseky operace, v pořadí zpracování (§3) - musí obsahovat
   *  aspoň jeden. */
  features: MillingFeature[];
}
