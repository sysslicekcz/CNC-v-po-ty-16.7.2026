import type { TurningSubtype, MachiningMode, MeasurementRequirement } from "./turning-subtype";
import { TurningFeatureGeometry } from "./turning-feature-geometry";
import { TurningPassStrategyInput } from "./turning-pass-strategy-input";

/** §2 "cuttingSpeedMMin"/"feedPerRevolutionMm"/"spindleSpeedRpm" na úrovni
 *  featuru - explicitní PŘEPIS řešení `CuttingConditionResolver` (Fáze B
 *  úroveň 1 "explicitní hodnota"), ne nová konkurenční cesta - strategie ho
 *  předá resolveru přesně jako `explicitValues`. */
export interface TurningCuttingConditionOverride {
  cuttingSpeedMMin?: number;
  feedPerRevolutionMm?: number;
  spindleSpeedRpm?: number;
  /** §5 "explicit diameter override" - přeskočí výchozí pravidlo efektivního
   *  průměru podle `subtype` (viz `resolveEffectiveDiameterMm`). */
  explicitDiameterOverrideMm?: number;
}

/**
 * Jeden technologický úsek soustružnické operace (AP-MCE-001 Fáze C §3) -
 * jedna operace nese `TurningCalculationInput.features: TurningFeature[]`,
 * v POŘADÍ `sequence` (§3 "zachovat pořadí"). Technologická pole ze zadání
 * §2 (`startDiameterMm`, `cuttingSpeedMMin`, `passCount`, `clampingCount`,
 * `interruptedCut`, ...) jsou VŠECHNA tady, PER FEATURE - jedna operace může
 * kombinovat čelní srovnání + hrubovací průchod + zapíchnutí + závit (§3
 * příklady), každý s jinou geometrií/nástrojem/podmínkami.
 */
export interface TurningFeature {
  id: string;
  /** Pořadí v rámci operace (0-based) - určuje pořadí výpočtu i pořadí
   *  breakdownu, NIKDY se nepřeuspořádává (§3 "zachovat pořadí"). */
  sequence: number;
  subtype: TurningSubtype;
  machiningMode: MachiningMode;
  geometry: TurningFeatureGeometry;
  /** Nepovinné - feature bez konkrétního nástroje (custom_path bez
   *  přiřazení) je platný vstup, jen se pro něj nepočítá výměna nástroje ani
   *  nástrojová životnost. */
  toolProfileId?: string;
  cuttingConditionOverride?: TurningCuttingConditionOverride;
  passStrategy?: TurningPassStrategyInput;
  /** §3 "započítat měření pouze tam, kde je požadováno" - výchozí `"none"`. */
  measurementRequirement?: MeasurementRequirement;
  notes?: string;

  dwellTimeSec?: number;
  /** Výchozí 1 - kolikrát se díl v tomhle featuru upíná (obvykle 1, ale
   *  přeupnutí mezi featury může být zadané explicitně). */
  clampingCount?: number;
  fixtureChangeCount?: number;
  /** §2 - explicitní PŘEPIS automatického výpočtu výměn z opotřebení PRO
   *  TENHLE nástroj (na rozdíl od operačního `plannedToolChanges`, který je
   *  souhrnný za celou operaci - viz `TurningCalculationInput`). */
  plannedToolChanges?: number;
  coolantMode?: string;
  interruptedCut?: boolean;
  internalMachining?: boolean;
}
