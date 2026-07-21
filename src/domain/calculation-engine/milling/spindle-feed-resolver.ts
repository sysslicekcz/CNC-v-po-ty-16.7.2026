import { CuttingSpeed } from "../value-objects/cutting-speed";
import { SpindleSpeed } from "../value-objects/spindle-speed";
import { Diameter } from "../value-objects/diameter";
import { CalculationIssue } from "../entities/types";
import { millingIssue } from "./milling-issue-codes";

export interface ResolveSpindleSpeedInput {
  cuttingSpeedMMin: number;
  toolDiameterMm: number;
  /** §2 `spindleSpeedRpm` na úrovni featuru - má přednost před odvozením z
   *  `cuttingSpeedMMin` (operátor zná lépe, jaké otáčky chce použít). */
  explicitSpindleSpeedRpm?: number;
  machineMinRpm?: number;
  machineMaxRpm?: number;
  /** §8 "maxRpm nástroje, pokud existuje" - fyzikálně limit řezné rychlosti,
   *  skutečný otáčkový limit proto závisí na `toolDiameterMm` (§5). */
  toolMaxCuttingSpeedMMin?: number;
}

export interface ResolvedSpindleSpeed {
  rpm: number;
  clampedToMachineLimit: boolean;
  clampedToToolLimit: boolean;
  belowMachineMinimum: boolean;
  warnings: CalculationIssue[];
}

/**
 * Odvození a omezení otáček vřetena (AP-MCE-001 Fáze D §5) - ČISTÁ funkce,
 * žádné I/O. Základní vzorec `n = Vc×1000/(π×D)` NEDUPLIKUJE - použije
 * existující `SpindleSpeed.fromCuttingSpeed` (Fáze A hodnotový objekt), stejná
 * konvence jako Fáze C `turning/spindle-speed-resolver.ts`.
 */
export function resolveSpindleSpeed(input: ResolveSpindleSpeedInput): ResolvedSpindleSpeed {
  const warnings: CalculationIssue[] = [];

  let rpm =
    input.explicitSpindleSpeedRpm ??
    SpindleSpeed.fromCuttingSpeed(CuttingSpeed.ofMetersPerMinute(input.cuttingSpeedMMin), Diameter.ofMillimeters(input.toolDiameterMm)).rpm;
  const isExplicit = input.explicitSpindleSpeedRpm !== undefined;

  let clampedToToolLimit = false;
  if (input.toolMaxCuttingSpeedMMin !== undefined) {
    const toolMaxRpm = SpindleSpeed.fromCuttingSpeed(
      CuttingSpeed.ofMetersPerMinute(input.toolMaxCuttingSpeedMMin),
      Diameter.ofMillimeters(input.toolDiameterMm)
    ).rpm;
    if (rpm > toolMaxRpm && !isExplicit) {
      rpm = toolMaxRpm;
      clampedToToolLimit = true;
    }
  }

  let clampedToMachineLimit = false;
  if (input.machineMaxRpm !== undefined && rpm > input.machineMaxRpm && !isExplicit) {
    rpm = input.machineMaxRpm;
    clampedToMachineLimit = true;
    warnings.push(millingIssue("RPM_CLAMPED_TO_MACHINE_LIMIT", `Vypočtené otáčky přesáhly maximum stroje (${input.machineMaxRpm} min⁻¹) - hodnota byla omezena.`));
  }

  const belowMachineMinimum = input.machineMinRpm !== undefined && rpm < input.machineMinRpm;
  if (belowMachineMinimum) {
    warnings.push(millingIssue("RPM_BELOW_MACHINE_MINIMUM", `Otáčky (${Math.round(rpm)} min⁻¹) jsou pod minimem stroje (${input.machineMinRpm} min⁻¹).`));
  }

  return { rpm, clampedToMachineLimit, clampedToToolLimit, belowMachineMinimum, warnings };
}

export interface ResolveFeedRateInput {
  feedPerToothMm: number;
  teethCount: number;
  spindleSpeedRpm: number;
  /** §2 `feedRateMmMin` explicitní PŘEPIS `fz × z × n` - operátor zadal
   *  rychlost posuvu přímo (nezávisle na počtu zubů/otáčkách). */
  explicitFeedRateMmMin?: number;
  machineMaxFeedRateMmMin?: number;
  toolMaxFeedPerToothMm?: number;
}

export interface ResolvedFeedRate {
  feedRateMmMin: number;
  clampedToMachineLimit: boolean;
  clampedToToolLimit: boolean;
  warnings: CalculationIssue[];
}

/**
 * Odvození a omezení rychlosti posuvu (AP-MCE-001 Fáze D §5) -
 * `feedRateMmMin = feedPerToothMm × teethCount × spindleSpeedRpm`, s
 * omezením na maximální posuv stroje/nástroje (§5/§8). Explicitní
 * `feedRateMmMin` na featuru přeskočí vzorec úplně (stejná priorita jako u
 * `explicitSpindleSpeedRpm`).
 */
export function resolveFeedRate(input: ResolveFeedRateInput): ResolvedFeedRate {
  const warnings: CalculationIssue[] = [];
  let feedRateMmMin = input.explicitFeedRateMmMin ?? input.feedPerToothMm * input.teethCount * input.spindleSpeedRpm;
  const isExplicit = input.explicitFeedRateMmMin !== undefined;

  let clampedToToolLimit = false;
  if (input.toolMaxFeedPerToothMm !== undefined && !isExplicit) {
    const toolMaxFeedRateMmMin = input.toolMaxFeedPerToothMm * input.teethCount * input.spindleSpeedRpm;
    if (feedRateMmMin > toolMaxFeedRateMmMin) {
      feedRateMmMin = toolMaxFeedRateMmMin;
      clampedToToolLimit = true;
    }
  }

  let clampedToMachineLimit = false;
  if (input.machineMaxFeedRateMmMin !== undefined && feedRateMmMin > input.machineMaxFeedRateMmMin) {
    feedRateMmMin = input.machineMaxFeedRateMmMin;
    clampedToMachineLimit = true;
    warnings.push(
      millingIssue("FEED_CLAMPED_TO_MACHINE_LIMIT", `Vypočtený posuv přesáhl maximum stroje (${input.machineMaxFeedRateMmMin} mm/min) - hodnota byla omezena.`)
    );
  }

  return { feedRateMmMin, clampedToMachineLimit, clampedToToolLimit, warnings };
}
