import type { MillingSubtype, MachiningMode, MeasurementRequirement } from "./milling-subtype";
import { MillingFeatureGeometry } from "./milling-feature-geometry";
import { MillingPathStrategyInput, MillingPassStrategyInput } from "./milling-path-strategy-input";

/** §2 "cuttingSpeedMMin"/"feedPerToothMm"/"feedRateMmMin"/"spindleSpeedRpm" na
 *  úrovni featuru - explicitní PŘEPIS řešení `CuttingConditionResolver` (Fáze
 *  B úroveň 1 "explicitní hodnota"), stejný princip jako Fáze C
 *  `TurningCuttingConditionOverride`. `toolDiameterMm`/`teethCount` smí featur
 *  přepsat i nezávisle na `ToolProfile` (např. nástroj bez profilu). */
export interface MillingCuttingConditionOverride {
  cuttingSpeedMMin?: number;
  feedPerToothMm?: number;
  feedRateMmMin?: number;
  spindleSpeedRpm?: number;
  toolDiameterMm?: number;
  teethCount?: number;
}

/** §3 "toolEngagement" - skutečné radiální/axiální zapojení nástroje v
 *  materiálu PRO TENTO záběr (na rozdíl od `geometry.pocketDepthMm`/...,
 *  což je celková geometrie útvaru) - vstup pro `MillingPowerEstimator`
 *  (§8 "widthOfCut"/"depthOfCut") a `engagementCoefficient` (§11). */
export interface MillingToolEngagement {
  widthOfCutMm?: number;
  depthOfCutMm?: number;
}

/**
 * Jeden technologický úsek frézovací operace (AP-MCE-001 Fáze D §3) - jedna
 * operace nese `MillingCalculationInput.features: MillingFeature[]`, v
 * POŘADÍ `sequence` (§3 "zachovat pořadí"). Technologická pole ze zadání §2
 * jsou VŠECHNA tady, PER FEATURE - jedna operace může kombinovat srovnání
 * roviny + hrubování kapsy + dokončení kapsy + obvodovou konturu + vrtání
 * (§3 příklady), každý s jinou geometrií/nástrojem/podmínkami.
 */
export interface MillingFeature {
  id: string;
  /** Pořadí v rámci operace (0-based) - určuje pořadí výpočtu i breakdownu,
   *  NIKDY se nepřeuspořádává (§3 "zachovat pořadí"). */
  sequence: number;
  subtype: MillingSubtype;
  machiningMode: MachiningMode;
  geometry: MillingFeatureGeometry;
  /** Nepovinné - feature bez konkrétního nástroje je platný vstup (jen se
   *  pro něj nepočítá výměna nástroje ani nástrojová životnost). */
  toolProfileId?: string;
  cuttingConditionOverride?: MillingCuttingConditionOverride;
  pathStrategy?: MillingPathStrategyInput;
  passStrategy?: MillingPassStrategyInput;
  /** §3 "započítat měření jen tam, kde je vyžadováno" - výchozí `"none"`. */
  measurementRequirement?: MeasurementRequirement;
  toolEngagement?: MillingToolEngagement;
  notes?: string;

  dwellTimeSec?: number;
  /** §2 - explicitní PŘEPIS automatického výpočtu výměn z opotřebení PRO
   *  TENHLE nástroj (stejný princip jako Fáze C `TurningFeature.
   *  plannedToolChanges`). */
  plannedToolChanges?: number;
  coolantMode?: string;
  interruptedCut?: boolean;
  /** §2 "adaptiveClearing" - trochoidní/adaptivní hrubovací dráha (menší
   *  radiální zápich, vyšší axiální/rychlost) - MVP dopad: sníží
   *  `engagementCoefficient` (§11), viz `milling-coefficients.ts`. */
  adaptiveClearing?: boolean;
}
