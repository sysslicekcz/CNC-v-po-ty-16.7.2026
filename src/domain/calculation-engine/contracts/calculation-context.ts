import { RuleVersion } from "../rules/rule-version";
import { MaterialProfileSnapshot } from "../profiles/material-profile-snapshot";
import { MachineProfileSnapshot } from "../profiles/machine-profile-snapshot";
import { ToolProfileSnapshot } from "../profiles/tool-profile-snapshot";
import { CuttingConditionSnapshot } from "../cutting-conditions/cutting-condition-snapshot";

/**
 * Vše, co strategie/engine potřebuje NAD RÁMEC samotného vstupu, aby zůstala
 * čistá funkce bez I/O (AP-MCE-001 §11: "strategie je pure - žádný přístup k
 * repozitářům"). Application vrstva (`CalculateOperationUseCase`) kontext
 * sestaví PŘED voláním `CalculationEngine.calculate(...)`.
 *
 * Fáze A nese jen `ruleVersion` - `material`/`machine`/`tool` profily
 * (`MaterialProfile`/`MachineProfile`/`ToolProfile`, AP-MCE-001 §06-08) a
 * `cuttingCondition`/`calibration` přibudou jako ADITIVNÍ, nepovinná pole až
 * ve Fázi B/G (existence materiálu/stroje/nástroje se v Fázi A ověřuje přímo
 * přes existující `MaterialRepository`/`MachineRepository`/`ToolRepository` v
 * use casu, ne přes profil - viz `CalculateOperationUseCase`). Přidání těchto
 * polí nikdy nebude vyžadovat změnu existujících strategií, protože ještě
 * žádná neexistuje (Fáze A neregistruje žádnou konkrétní `CalculationStrategy`).
 */
export interface CalculationContext {
  ruleVersion: RuleVersion;
  /** AP-MCE-001 Fáze B §6 - sestavuje `CalculationContextResolver`
   *  (Application vrstva) PŘED voláním `CalculationEngine.calculate(...)`,
   *  strategie sama repozitáře nikdy nevolá (§06 "strategie nesmí sama
   *  načítat data z repozitáře"). `toolProfileSnapshot` je nepovinný i
   *  koncepčně (operace bez nástroje, např. kontrola/NDT), ostatní jsou
   *  nepovinné jen technicky (dokud je ještě žádná `CalculationStrategy`
   *  v aktuální fázi nevyžaduje - viz Fáze A komentář výše). */
  materialProfileSnapshot?: MaterialProfileSnapshot;
  machineProfileSnapshot?: MachineProfileSnapshot;
  toolProfileSnapshot?: ToolProfileSnapshot;
  cuttingConditionSnapshot?: CuttingConditionSnapshot;
  /** `MachineProfile.calibrationProfileId`, pokud stroj má kalibrační profil
   *  přiřazený - samotná `CalibrationProfile` entita/repozitář je mimo rozsah
   *  Fáze B (zadání žádá jen referenční pole na `MachineProfile`, ne plný
   *  kalibrační model - ten čeká na fázi, která kalibrační data skutečně
   *  používá). */
  calibrationProfileId?: string;
  /**
   * AP-MCE-001 Fáze C §5/§6 - jedna soustružnická operace může mít VÍC
   * `TurningFeature`, každý s jiným nástrojem/podtypem, tedy potenciálně s
   * JINOU vyřešenou řeznou podmínkou (na rozdíl od `cuttingConditionSnapshot`
   * výš, což je JEDNA hodnota pro celou operaci - dost pro Fázi B, nedost pro
   * víc-featurové operace Fáze C). `CalculateTurningOperationUseCase`
   * (Application vrstva) zavolá `CuttingConditionResolverService.resolve()`
   * (Fáze B, beze změny) JEDNOU PRO KAŽDÝ feature (repozitářový přístup smí
   * mít jen use case, ne strategie) a výsledek sem uloží podle `TurningFeature.id`
   * - `TurningCalculationStrategy` pak čte už JEN hotová data, žádný další
   * resolver nevolá (zůstává čistá funkce).
   */
  turningCuttingConditionsByFeatureId?: Readonly<Record<string, TurningResolvedCuttingConditionForFeature>>;
  /**
   * AP-MCE-001 Fáze C §3/§8 - stejný důvod jako `turningCuttingConditionsBy
   * FeatureId`: `toolProfileSnapshot` výš je JEDEN nástroj pro celou operaci
   * (dost pro Fázi B, kde `OperationCalculationInputBase.toolId` je taky jen
   * jeden), ale jedna soustružnická operace může používat RŮZNÉ nástroje v
   * různých `TurningFeature` (§3 "započítat výměnu nástroje mezi feature").
   * `CalculateTurningOperationUseCase` zavolá `ToolProfileResolver.resolve
   * Snapshot()` (Fáze B, beze změny) pro KAŽDÝ unikátní `TurningFeature.
   * toolProfileId` a uloží sem podle `TurningFeature.id`.
   */
  toolProfileSnapshotsByFeatureId?: Readonly<Record<string, ToolProfileSnapshot>>;
  /**
   * AP-MCE-001 Fáze D §5/§6 - stejný důvod jako `turningCuttingConditionsBy
   * FeatureId`, jen pro `MillingFeature` (`feedPerToothMm`/`mm_per_tooth`
   * místo `feedPerRevolutionMm`/`mm_per_rev`). `CalculateMillingOperationUse
   * Case` (Application vrstva) zavolá `CuttingConditionResolverService.
   * resolve()` JEDNOU PRO KAŽDÝ feature a výsledek sem uloží podle
   * `MillingFeature.id` - `MillingCalculationStrategy` pak čte už jen hotová
   * data.
   */
  millingCuttingConditionsByFeatureId?: Readonly<Record<string, MillingResolvedCuttingConditionForFeature>>;
  /**
   * AP-MCE-001 Fáze E §5/§6 - stejný důvod jako `millingCuttingConditionsBy
   * FeatureId`, jen pro `GrindingFeature` (`workpieceSpeedRpm`/`wheelSpeedMps`/
   * `tableSpeedMmMin` místo `feedPerToothMm`).
   */
  grindingCuttingConditionsByFeatureId?: Readonly<Record<string, GrindingResolvedCuttingConditionForFeature>>;
}

/** Jedna položka `grindingCuttingConditionsByFeatureId` - zúžený výřez
 *  `CuttingConditionResolution` (Fáze B) na to, co brusírenské strategie
 *  skutečně čtou. */
export interface GrindingResolvedCuttingConditionForFeature {
  workpieceSpeedRpm?: number;
  workpieceSpeedSource?: string;
  wheelSpeedMps?: number;
  wheelSpeedSource?: string;
  tableSpeedMmMin?: number;
  tableSpeedSource?: string;
}

/** Jedna položka `millingCuttingConditionsByFeatureId` - zúžený výřez
 *  `CuttingConditionResolution` (Fáze B) na to, co `MillingCalculationStrategy`
 *  skutečně čte (řezná rychlost + posuv na zub, se zdrojem/důvěryhodností
 *  pro breakdown/confidence). */
export interface MillingResolvedCuttingConditionForFeature {
  cuttingSpeedMMin?: number;
  cuttingSpeedSource?: string;
  cuttingSpeedConfidence?: number;
  feedPerToothMm?: number;
  feedSource?: string;
  feedConfidence?: number;
}

/** Jedna položka `turningCuttingConditionsByFeatureId` - zúžený výřez
 *  `CuttingConditionResolution` (Fáze B) na to, co `TurningCalculationStrategy`
 *  skutečně čte (řezná rychlost + posuv na otáčku, se zdrojem/důvěryhodností
 *  pro breakdown/confidence). */
export interface TurningResolvedCuttingConditionForFeature {
  cuttingSpeedMMin?: number;
  cuttingSpeedSource?: string;
  cuttingSpeedConfidence?: number;
  feedPerRevolutionMm?: number;
  feedSource?: string;
  feedConfidence?: number;
}
