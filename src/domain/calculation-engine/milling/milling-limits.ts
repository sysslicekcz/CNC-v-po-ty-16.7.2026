import { CalculationIssue } from "../entities/types";
import { millingIssue } from "./milling-issue-codes";
import { MachineProfileView, ToolProfileView } from "./milling-context-views";
import type { MillingSubtype } from "./milling-subtype";

const MILLING_MACHINE_CATEGORIES = new Set(["milling", "turn_mill"]);
/** §8 "dostupnost rigid tapping"/"dostupnost 3D interpolace" - generické
 *  kódy schopnosti (`MachineCapabilitySummary.capabilityTypeCode`), stejná
 *  konvence jako zbytek platformy (žádný nový mechanismus, jen dvě nové
 *  hodnoty existujícího otevřeného katalogu kódů). */
const RIGID_TAPPING_CAPABILITY_CODE = "rigid_tapping";
const THREE_D_INTERPOLATION_CAPABILITY_CODE = "3d_interpolation";
const THREE_D_SUBTYPES = new Set<MillingSubtype>(["three_d"]);

/** §8 "machine capability pro konkrétní subtype" - blokující, pokud je
 *  `machineCategory` ZNÁMÝ a NENÍ frézka/obráběcí centrum/multifunkční
 *  stroj. Neznámá kategorie se netrestá (chybějící údaj ≠ prokázaná
 *  nevhodnost). */
export function checkMachineMillingCapability(machineCategory: string | undefined): CalculationIssue[] {
  if (machineCategory === undefined || MILLING_MACHINE_CATEGORIES.has(machineCategory)) return [];
  return [millingIssue("MACHINE_NOT_MILLING_CAPABLE", `Stroj kategorie "${machineCategory}" není frézka ani multifunkční stroj.`)];
}

/** §8 "axisCount" - blokující, pokud je `machine.axisCount` ZNÁMÝ a nižší
 *  než minimum požadované subtypem (`three_d`/`two_and_half_d` potřebují
 *  aspoň 3 osy, ostatní stačí 2). */
export function checkMachineAxisCount(machine: MachineProfileView, subtype: MillingSubtype): CalculationIssue[] {
  const requiredAxes = subtype === "three_d" || subtype === "two_and_half_d" ? 3 : 2;
  if (machine.axisCount === undefined || machine.axisCount >= requiredAxes) return [];
  return [
    millingIssue(
      "MACHINE_AXIS_COUNT_INSUFFICIENT",
      `Stroj má ${machine.axisCount} os, ale subtype "${subtype}" vyžaduje aspoň ${requiredAxes}.`
    ),
  ];
}

/** §7/§8 "rigid tapping vs. jiný režim, pokud je dostupný" - blokující pro
 *  `threading` (řezání závitu frézováním/vrtákem obvykle vyžaduje
 *  synchronizaci vřetena se Z-osou), pokud stroj má `availableFunctionCodes`
 *  vyplněné a rigid tapping mezi nimi NENÍ. */
export function checkRigidTappingAvailability(machine: MachineProfileView, subtype: MillingSubtype): CalculationIssue[] {
  if (subtype !== "threading") return [];
  if (machine.availableFunctionCodes.length === 0 || machine.availableFunctionCodes.includes(RIGID_TAPPING_CAPABILITY_CODE)) return [];
  return [millingIssue("RIGID_TAPPING_UNAVAILABLE", `Stroj nemá potvrzenou funkci "${RIGID_TAPPING_CAPABILITY_CODE}" požadovanou pro řezání závitu.`)];
}

/** §8 "dostupnost 3D interpolace" - blokující pro `three_d`, pokud stroj má
 *  `availableFunctionCodes` vyplněné a 3D interpolace mezi nimi NENÍ. */
export function checkThreeDCapabilityAvailability(machine: MachineProfileView, subtype: MillingSubtype): CalculationIssue[] {
  if (!THREE_D_SUBTYPES.has(subtype)) return [];
  if (machine.availableFunctionCodes.length === 0 || machine.availableFunctionCodes.includes(THREE_D_INTERPOLATION_CAPABILITY_CODE)) return [];
  return [millingIssue("THREE_D_CAPABILITY_UNAVAILABLE", `Stroj nemá potvrzenou funkci "${THREE_D_INTERPOLATION_CAPABILITY_CODE}" požadovanou pro 3D obrábění.`)];
}

/** §8 "tool suitability"/"tool geometry" - blokující, pokud nástroj má
 *  vyplněné `supportedOperationCategories` a frézování mezi nimi NENÍ. */
export function checkToolMillingCapability(tool: ToolProfileView): CalculationIssue[] {
  if (tool.supportedOperationCategories.length === 0 || tool.supportedOperationCategories.includes("milling")) return [];
  return [millingIssue("TOOL_NOT_MILLING_CAPABLE", `Nástroj "${tool.id}" nepodporuje kategorii operace "milling".`)];
}

/** §8 "tool supported material groups" - VAROVNÁ, stejná sémantika jako
 *  Fáze C `checkToolMaterialCompatibility`. */
export function checkToolMaterialCompatibility(tool: ToolProfileView, materialGroupId: string): CalculationIssue[] {
  if (tool.suitableMaterialGroupIds.length === 0 || tool.suitableMaterialGroupIds.includes(materialGroupId)) return [];
  return [millingIssue("TOOL_MATERIAL_MISMATCH", `Nástroj "${tool.id}" není doporučený pro materiálovou skupinu "${materialGroupId}".`)];
}

/** §8 "tool diameter vs. geometrie feature" - blokující, pokud je nástroj
 *  ŠIRŠÍ než útvar, do kterého má vjet (kapsa/drážka) - fyzicky nemožné. */
export function checkToolFitsFeature(tool: ToolProfileView, minFeatureWidthMm: number | undefined): CalculationIssue[] {
  if (tool.diameterMm === undefined || minFeatureWidthMm === undefined) return [];
  if (tool.diameterMm <= minFeatureWidthMm) return [];
  return [
    millingIssue(
      "TOOL_TOO_LARGE_FOR_FEATURE",
      `Nástroj "${tool.id}" (⌀${tool.diameterMm} mm) je širší než útvar (${minFeatureWidthMm} mm).`
    ),
  ];
}

/** §8 "flute length vs. hloubka"/"usable length vs. hloubka" - blokující,
 *  pokud je hloubka záběru VĚTŠÍ než použitelná délka nástroje (stopka by
 *  narazila do materiálu/upínače). */
export function checkToolLongEnoughForDepth(tool: ToolProfileView, requiredDepthMm: number | undefined): CalculationIssue[] {
  if (tool.usableLengthMm === undefined || requiredDepthMm === undefined) return [];
  if (requiredDepthMm <= tool.usableLengthMm) return [];
  return [
    millingIssue(
      "TOOL_TOO_SHORT_FOR_DEPTH",
      `Nástroj "${tool.id}" (použitelná délka ${tool.usableLengthMm} mm) je příliš krátký na hloubku ${requiredDepthMm} mm.`
    ),
  ];
}

export interface WorkEnvelopeLike {
  maxLengthMm?: number;
  maxWidthMm?: number;
  maxHeightMm?: number;
  maxDiameterMm?: number;
}

/** §8 "workEnvelope"/"maxPartDimensions" - BLOKUJÍCÍ, stejná klasifikace
 *  jako Fáze C `checkWorkEnvelope`. */
export function checkWorkEnvelope(machine: MachineProfileView, lengthMm: number, widthMm: number, heightMm: number): CalculationIssue[] {
  const envelope = machine.maxPartDimensions ?? machine.workEnvelope;
  if (!envelope) return [];
  const exceeds =
    (envelope.maxLengthMm !== undefined && lengthMm > envelope.maxLengthMm) ||
    (envelope.maxWidthMm !== undefined && widthMm > envelope.maxWidthMm) ||
    (envelope.maxHeightMm !== undefined && heightMm > envelope.maxHeightMm);
  if (!exceeds) return [];
  return [
    millingIssue(
      "WORK_ENVELOPE_EXCEEDED",
      `Rozměr dílu (${lengthMm} × ${widthMm} × ${heightMm} mm) překračuje pracovní prostor stroje "${machine.physicalMachineId}".`
    ),
  ];
}

export interface PowerAndTorqueCheckResult {
  issues: CalculationIssue[];
  powerUtilizationPercent?: number;
}

/** §8 "výkon"/"kroutící moment" - OBA vždy jen `warning`, stejná klasifikace
 *  jako Fáze C `checkPowerAndTorque` (`T[Nm] = P[kW] × 9550 / n[rpm]`, žádný
 *  druhý nezávislý model). */
export function checkPowerAndTorque(requiredPowerKw: number, spindleSpeedRpm: number, machine: MachineProfileView): PowerAndTorqueCheckResult {
  const issues: CalculationIssue[] = [];
  const powerUtilizationPercent = machine.maxPowerKw ? (requiredPowerKw / machine.maxPowerKw) * 100 : undefined;

  if (machine.maxPowerKw !== undefined && requiredPowerKw > machine.maxPowerKw) {
    issues.push(
      millingIssue("MACHINE_POWER_EXCEEDED", `Odhadovaný požadovaný výkon (${requiredPowerKw.toFixed(2)} kW) přesahuje maximum stroje (${machine.maxPowerKw} kW).`)
    );
  }

  if (machine.maxTorqueNm !== undefined && spindleSpeedRpm > 0) {
    const requiredTorqueNm = (requiredPowerKw * 9550) / spindleSpeedRpm;
    if (requiredTorqueNm > machine.maxTorqueNm) {
      issues.push(
        millingIssue("MACHINE_TORQUE_EXCEEDED", `Odhadovaný kroutící moment (${requiredTorqueNm.toFixed(1)} Nm) přesahuje maximum stroje (${machine.maxTorqueNm} Nm).`)
      );
    }
  }

  return { issues, powerUtilizationPercent };
}
