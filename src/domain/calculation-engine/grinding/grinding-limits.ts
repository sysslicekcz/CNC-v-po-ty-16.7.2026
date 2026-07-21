import { CalculationIssue } from "../entities/types";
import { grindingIssue } from "./grinding-issue-codes";
import { MachineProfileView, ToolProfileView } from "./grinding-context-views";

const GRINDING_MACHINE_CATEGORIES = new Set(["grinding"]);

/** §9 "internal grinding capability"/"surface grinding capability"/
 *  "centerless capability" - generické kódy schopnosti
 *  (`MachineCapabilitySummary.capabilityTypeCode`), stejná konvence jako
 *  Fáze D `rigid_tapping`/`3d_interpolation` (`MachineCategory` enum, Krok 5,
 *  má jen jednu obecnou hodnotu `"grinding"` - jemnější rozlišení nese
 *  `availableFunctionCodes`, ne nová hodnota `MachineCategory`). */
const CYLINDRICAL_GRINDING_CAPABILITY_CODE = "cylindrical_grinding";
const INTERNAL_GRINDING_CAPABILITY_CODE = "internal_grinding";
const SURFACE_GRINDING_CAPABILITY_CODE = "surface_grinding";
const CENTERLESS_GRINDING_CAPABILITY_CODE = "centerless_grinding";

/** §9 "machine capability pro konkrétní subtype" - blokující, pokud je
 *  `machineCategory` ZNÁMÝ a NENÍ bruska. Neznámá kategorie se netrestá. */
export function checkMachineGrindingCapability(machineCategory: string | undefined): CalculationIssue[] {
  if (machineCategory === undefined || GRINDING_MACHINE_CATEGORIES.has(machineCategory)) return [];
  return [grindingIssue("INVALID_GRINDING_SUBTYPE", `Stroj kategorie "${machineCategory}" není bruska.`)];
}

function checkCapability(machine: MachineProfileView, code: string, issueCode: "MACHINE_NOT_CYLINDRICAL_GRINDING_CAPABLE" | "MACHINE_NOT_SURFACE_GRINDING_CAPABLE" | "MACHINE_NOT_INTERNAL_GRINDING_CAPABLE" | "MACHINE_NOT_CENTERLESS_CAPABLE", label: string): CalculationIssue[] {
  if (machine.availableFunctionCodes.length === 0 || machine.availableFunctionCodes.includes(code)) return [];
  return [grindingIssue(issueCode, `Stroj nemá potvrzenou funkci "${code}" požadovanou pro ${label}.`)];
}

export function checkCylindricalGrindingCapability(machine: MachineProfileView): CalculationIssue[] {
  return checkCapability(machine, CYLINDRICAL_GRINDING_CAPABILITY_CODE, "MACHINE_NOT_CYLINDRICAL_GRINDING_CAPABLE", "broušení na kulato");
}

export function checkInternalGrindingCapability(machine: MachineProfileView): CalculationIssue[] {
  return checkCapability(machine, INTERNAL_GRINDING_CAPABILITY_CODE, "MACHINE_NOT_INTERNAL_GRINDING_CAPABLE", "vnitřní broušení");
}

export function checkSurfaceGrindingCapability(machine: MachineProfileView): CalculationIssue[] {
  return checkCapability(machine, SURFACE_GRINDING_CAPABILITY_CODE, "MACHINE_NOT_SURFACE_GRINDING_CAPABLE", "rovinné broušení");
}

export function checkCenterlessGrindingCapability(machine: MachineProfileView): CalculationIssue[] {
  return checkCapability(machine, CENTERLESS_GRINDING_CAPABILITY_CODE, "MACHINE_NOT_CENTERLESS_CAPABLE", "bezhroté broušení");
}

/** §9 "wheel suitability for material" - VAROVNÁ, stejná sémantika jako
 *  Fáze C/D. */
export function checkWheelMaterialCompatibility(wheel: ToolProfileView, materialGroupId: string): CalculationIssue[] {
  if (wheel.suitableMaterialGroupIds.length === 0 || wheel.suitableMaterialGroupIds.includes(materialGroupId)) return [];
  return [grindingIssue("WHEEL_MATERIAL_MISMATCH", `Kotouč "${wheel.id}" není doporučený pro materiálovou skupinu "${materialGroupId}".`)];
}

/** §9 "wheel suitability" - blokující, pokud kotouč má vyplněné
 *  `supportedOperationCategories` a broušení mezi nimi NENÍ. */
export function checkWheelGrindingCapability(wheel: ToolProfileView): CalculationIssue[] {
  if (wheel.supportedOperationCategories.length === 0 || wheel.supportedOperationCategories.includes("grinding")) return [];
  return [grindingIssue("WHEEL_GEOMETRY_MISMATCH", `Kotouč "${wheel.id}" nepodporuje kategorii operace "grinding".`)];
}

/** §9 "max wheel speed" - blokující, pokud odvozená obvodová rychlost kotouče
 *  (m/s) přesáhne `ToolProfile.maxCuttingSpeedMMin` (znovupoužité jako
 *  bezpečná mez obvodové rychlosti kotouče, převedená na m/s - stejné pole,
 *  jiná fyzikální interpretace podle technologie, viz Fáze C/D precedens
 *  "jedno pole, různé použití podle kontextu strategie"). */
export function checkWheelSpeedLimit(wheelSpeedMps: number, wheel: ToolProfileView): CalculationIssue[] {
  if (wheel.maxCuttingSpeedMMin === undefined) return [];
  const maxWheelSpeedMps = wheel.maxCuttingSpeedMMin / 60;
  if (wheelSpeedMps <= maxWheelSpeedMps) return [];
  return [grindingIssue("WHEEL_SPEED_EXCEEDS_LIMIT", `Obvodová rychlost kotouče (${wheelSpeedMps.toFixed(1)} m/s) přesahuje bezpečné maximum (${maxWheelSpeedMps.toFixed(1)} m/s).`)];
}

/** §9 "wheel width vs. geometry" - blokující, pokud je kotouč užší, než je
 *  explicitně zadaný `crossFeedMm` (efektivní krok příčného posuvu JEDNOHO
 *  průchodu) - NENÍ to kontrola proti CELÉ `surfaceWidthMm` (širší plocha než
 *  kotouč je běžný, očekávaný případ řešený víc příčnými průchody, viz
 *  `resolveSurfacePassStrategy`), jen kontrola vnitřní konzistence explicitně
 *  zadaného kroku. */
export function checkWheelWidthFitsFeature(wheel: ToolProfileView, requiredWidthMm: number | undefined): CalculationIssue[] {
  if (wheel.widthMm === undefined || requiredWidthMm === undefined) return [];
  if (wheel.widthMm >= requiredWidthMm) return [];
  return [grindingIssue("WHEEL_GEOMETRY_MISMATCH", `Kotouč "${wheel.id}" (šířka ${wheel.widthMm} mm) je užší než vyžaduje broušená plocha (${requiredWidthMm} mm).`)];
}

export interface WorkEnvelopeLike {
  maxLengthMm?: number;
  maxWidthMm?: number;
  maxHeightMm?: number;
  maxDiameterMm?: number;
}

/** §9 "workEnvelope"/"maxPartDimensions" - BLOKUJÍCÍ, stejná klasifikace
 *  jako Fáze C/D. */
export function checkWorkEnvelope(machine: MachineProfileView, maxDiameterMm: number, lengthMm: number): CalculationIssue[] {
  const envelope = machine.maxPartDimensions ?? machine.workEnvelope;
  if (!envelope) return [];
  const exceedsDiameter = envelope.maxDiameterMm !== undefined && maxDiameterMm > envelope.maxDiameterMm;
  const exceedsLength = envelope.maxLengthMm !== undefined && lengthMm > envelope.maxLengthMm;
  if (!exceedsDiameter && !exceedsLength) return [];
  return [grindingIssue("WORK_ENVELOPE_EXCEEDED", `Rozměr dílu (⌀${maxDiameterMm} mm × ${lengthMm} mm) překračuje pracovní prostor stroje "${machine.physicalMachineId}".`)];
}

/** §9 "requested accuracy vs. machine capability" - blokující, pokud stroj
 *  má ZNÁMOU `positioningAccuracyMm` a je HRUBŠÍ (větší číslo = méně přesný)
 *  než požadovaná přesnost featuru. */
export function checkPrecisionCapability(machine: MachineProfileView, requiredAccuracyMm: number | undefined): CalculationIssue[] {
  if (machine.positioningAccuracyMm === undefined || requiredAccuracyMm === undefined) return [];
  if (machine.positioningAccuracyMm <= requiredAccuracyMm) return [];
  return [
    grindingIssue(
      "PRECISION_CAPABILITY_INSUFFICIENT",
      `Přesnost stroje (${machine.positioningAccuracyMm} mm) nestačí na požadovanou přesnost featuru (${requiredAccuracyMm} mm).`
    ),
  ];
}

export interface PowerCheckResult {
  issues: CalculationIssue[];
  powerUtilizationPercent?: number;
}

/** §9 "spindle power" - vždy jen `warning`, stejná klasifikace jako Fáze C/D. */
export function checkPower(requiredPowerKw: number, machine: MachineProfileView): PowerCheckResult {
  const issues: CalculationIssue[] = [];
  const powerUtilizationPercent = machine.maxPowerKw ? (requiredPowerKw / machine.maxPowerKw) * 100 : undefined;
  if (machine.maxPowerKw !== undefined && requiredPowerKw > machine.maxPowerKw) {
    issues.push(grindingIssue("MACHINE_POWER_EXCEEDED", `Odhadovaný požadovaný výkon (${requiredPowerKw.toFixed(2)} kW) přesahuje maximum stroje (${machine.maxPowerKw} kW).`));
  }
  return { issues, powerUtilizationPercent };
}
