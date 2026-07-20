import { CuttingSpeed } from "../value-objects/cutting-speed";
import { SpindleSpeed } from "../value-objects/spindle-speed";
import { Diameter } from "../value-objects/diameter";
import { CalculationIssue } from "../entities/types";

export interface ResolveSpindleSpeedInput {
  /** Řezná rychlost použitá pro výpočet otáček, POKUD `explicitSpindleSpeedRpm`
   *  není zadaný (vyřešená úrovní CuttingCondition/nástroj/materiál/systémový
   *  default, mimo tenhle resolver - viz `TurningCalculationStrategy`). */
  cuttingSpeedMMin: number;
  effectiveDiameterMm: number;
  /** §2 `spindleSpeedRpm` na vstupu featuru - pokud je zadaný, MÁ PŘEDNOST
   *  před odvozením z `cuttingSpeedMMin` (operátor zná lépe, jaké otáčky
   *  chce použít). Validaci "explicitní hodnota mimo limit" dělá `validate()`
   *  na `TurningCalculationStrategy` (§5: "podle pravidel rozhodni mezi
   *  blocking error a warningem") - tenhle resolver počítá jen `calculate()`
   *  fázi, kdy už je jisté, že blokující chyba nenastala.
   */
  explicitSpindleSpeedRpm?: number;
  machineMinRpm?: number;
  machineMaxRpm?: number;
  /** §5 "maxRpm nástroje, pokud existuje" - u nástroje jde fyzikálně o limit
   *  řezné rychlosti (materiál/geometrie břitu), skutečný otáčkový limit
   *  proto závisí na `effectiveDiameterMm` stejně jako u `cuttingSpeedMMin`
   *  samotné (viz `ToolProfile.maxCuttingSpeedMMin`). */
  toolMaxCuttingSpeedMMin?: number;
}

export interface ResolvedSpindleSpeed {
  rpm: number;
  /** `true`, pokud (auto-odvozené, NE explicitní) otáčky přesáhly `machineMaxRpm`
   *  a hodnota byla oříznuta (§5 - "nepoužívej automaticky nesmyslnou hodnotu,
   *  omez hodnotu podle stroje"). */
  clampedToMachineLimit: boolean;
  clampedToToolLimit: boolean;
  belowMachineMinimum: boolean;
  warnings: CalculationIssue[];
}

/**
 * Odvození a omezení otáček vřetena (AP-MCE-001 Fáze C §5) - ČISTÁ funkce,
 * žádné I/O. Základní vzorec (`n = Vc*1000/(π*D)`) NEDUPLIKUJE - použije
 * existující `SpindleSpeed.fromCuttingSpeed` (Fáze A hodnotový objekt),
 * tenhle modul jen přidává explicitní override a omezení podle stroje/nástroje.
 */
export function resolveSpindleSpeed(input: ResolveSpindleSpeedInput): ResolvedSpindleSpeed {
  const warnings: CalculationIssue[] = [];

  let rpm =
    input.explicitSpindleSpeedRpm ??
    SpindleSpeed.fromCuttingSpeed(CuttingSpeed.ofMetersPerMinute(input.cuttingSpeedMMin), Diameter.ofMillimeters(input.effectiveDiameterMm))
      .rpm;
  const isExplicit = input.explicitSpindleSpeedRpm !== undefined;

  let clampedToToolLimit = false;
  if (input.toolMaxCuttingSpeedMMin !== undefined) {
    const toolMaxRpm = SpindleSpeed.fromCuttingSpeed(
      CuttingSpeed.ofMetersPerMinute(input.toolMaxCuttingSpeedMMin),
      Diameter.ofMillimeters(input.effectiveDiameterMm)
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
    warnings.push({
      code: "RPM_CLAMPED_TO_MACHINE_LIMIT",
      severity: "warning",
      message: `Vypočtené otáčky přesáhly maximum stroje (${input.machineMaxRpm} min⁻¹) - hodnota byla omezena.`,
    });
  }

  const belowMachineMinimum = input.machineMinRpm !== undefined && rpm < input.machineMinRpm;
  if (belowMachineMinimum) {
    warnings.push({
      code: "RPM_BELOW_MACHINE_MINIMUM",
      severity: "warning",
      message: `Otáčky (${Math.round(rpm)} min⁻¹) jsou pod minimem stroje (${input.machineMinRpm} min⁻¹).`,
    });
  }

  return { rpm, clampedToMachineLimit, clampedToToolLimit, belowMachineMinimum, warnings };
}
