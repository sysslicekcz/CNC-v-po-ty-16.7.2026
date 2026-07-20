import { CalculationIssue } from "../entities/types";
import { turningIssue } from "./turning-issue-codes";
import { MachineProfileView, ToolProfileView } from "./turning-context-views";

const LATHE_CATEGORIES = new Set(["lathe", "turn_mill"]);

/** §7 "machine capability pro turning subtype" - blokující, pokud je
 *  `machineCategory` ZNÁMÝ a NENÍ soustruh/multifunkční stroj. Neznámá
 *  kategorie (`undefined`) se netrestá - chybějící údaj není totéž jako
 *  prokázaná nevhodnost (stejný princip jako `ToolProfile.suitableMaterial
 *  GroupIds.length === 0`, Fáze B). */
export function checkMachineTurningCapability(machineCategory: string | undefined): CalculationIssue[] {
  if (machineCategory === undefined || LATHE_CATEGORIES.has(machineCategory)) return [];
  return [turningIssue("MACHINE_NOT_TURNING_CAPABLE", `Stroj kategorie "${machineCategory}" není soustruh ani multifunkční stroj.`)];
}

/** §7 "tool suitability"/"tool geometry" - blokující, pokud nástroj má
 *  vyplněné `supportedOperationCategories` a soustružení mezi nimi NENÍ. */
export function checkToolTurningCapability(tool: ToolProfileView): CalculationIssue[] {
  if (tool.supportedOperationCategories.length === 0 || tool.supportedOperationCategories.includes("turning")) return [];
  return [turningIssue("TOOL_NOT_TURNING_CAPABLE", `Nástroj "${tool.id}" nepodporuje kategorii operace "turning".`)];
}

/** §7 "tool supported material groups" - VAROVNÁ, stejná sémantika jako
 *  `ToolMaterialCompatibilityService` (Fáze B): prázdný seznam = chybějící
 *  data, ne prokázaná univerzálnost. */
export function checkToolMaterialCompatibility(tool: ToolProfileView, materialGroupId: string): CalculationIssue[] {
  if (tool.suitableMaterialGroupIds.length === 0 || tool.suitableMaterialGroupIds.includes(materialGroupId)) return [];
  return [turningIssue("TOOL_MATERIAL_MISMATCH", `Nástroj "${tool.id}" není doporučený pro materiálovou skupinu "${materialGroupId}".`)];
}

/** §7 "workEnvelope"/"maxPartDimensions" - BLOKUJÍCÍ (stejná klasifikace jako
 *  `MachineEnvelopeExceededError`, Fáze B). Používá se pouze tehdy, když
 *  stroj limit skutečně má - chybějící `workEnvelope`/`maxPartDimensions`
 *  žádnou kontrolu neprovede. */
export function checkWorkEnvelope(machine: MachineProfileView, maxDiameterMm: number, lengthMm: number): CalculationIssue[] {
  const envelope = machine.maxPartDimensions ?? machine.workEnvelope;
  if (!envelope) return [];
  const exceedsDiameter = envelope.maxDiameterMm !== undefined && maxDiameterMm > envelope.maxDiameterMm;
  const exceedsLength = envelope.maxLengthMm !== undefined && lengthMm > envelope.maxLengthMm;
  if (!exceedsDiameter && !exceedsLength) return [];
  return [
    turningIssue(
      "WORK_ENVELOPE_EXCEEDED",
      `Rozměr dílu (⌀${maxDiameterMm} mm × ${lengthMm} mm) překračuje pracovní prostor stroje "${machine.physicalMachineId}".`
    ),
  ];
}

export interface PowerAndTorqueCheckResult {
  issues: CalculationIssue[];
  powerUtilizationPercent?: number;
}

/**
 * §7 "výkon"/"kroutící moment" - OBA vždy jen `warning` (nikdy blokující,
 * stejná klasifikace jako existující `MachineLimitError`/`assertWithinLimits`
 * z Fáze B - "překročení výkonu stroje" je §18 explicitně `warning`).
 * Kroutící moment se odvodí ze STEJNÉHO výkonového odhadu přes standardní
 * fyzikální vztah `T[Nm] = P[kW] × 9550 / n[rpm]` - žádný druhý, nezávislý
 * model navíc.
 */
export function checkPowerAndTorque(
  requiredPowerKw: number,
  spindleSpeedRpm: number,
  machine: MachineProfileView
): PowerAndTorqueCheckResult {
  const issues: CalculationIssue[] = [];
  const powerUtilizationPercent = machine.maxPowerKw ? (requiredPowerKw / machine.maxPowerKw) * 100 : undefined;

  if (machine.maxPowerKw !== undefined && requiredPowerKw > machine.maxPowerKw) {
    issues.push(
      turningIssue(
        "MACHINE_POWER_EXCEEDED",
        `Odhadovaný požadovaný výkon (${requiredPowerKw.toFixed(2)} kW) přesahuje maximum stroje (${machine.maxPowerKw} kW).`
      )
    );
  }

  if (machine.maxTorqueNm !== undefined && spindleSpeedRpm > 0) {
    const requiredTorqueNm = (requiredPowerKw * 9550) / spindleSpeedRpm;
    if (requiredTorqueNm > machine.maxTorqueNm) {
      issues.push(
        turningIssue(
          "MACHINE_TORQUE_EXCEEDED",
          `Odhadovaný kroutící moment (${requiredTorqueNm.toFixed(1)} Nm) přesahuje maximum stroje (${machine.maxTorqueNm} Nm).`
        )
      );
    }
  }

  return { issues, powerUtilizationPercent };
}
