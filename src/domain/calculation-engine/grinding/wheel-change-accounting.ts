import { ToolLifeProfile } from "../profiles/tool-life-profile";

export interface WheelUsageSegment {
  /** `undefined` = feature bez konkrétního kotouče - nezakládá výměnu. */
  wheelProfileId: string | undefined;
  grindingTimePerPieceMin: number;
  /** Objem odebraný TÍMHLE featurem na jeden kus (mm³) - vstup pro
   *  `ToolLifeProfile.expectedToolChanges(..., removedVolumePerPieceMm3)`
   *  (AP-MCE-001 Fáze E §8). */
  removedVolumePerPieceMm3: number;
  /** §2 `plannedWheelReplacements` PER FEATURE - explicitní PŘEPIS
   *  automatického výpočtu z opotřebení PRO TENHLE kotouč, stejný princip
   *  jako Fáze C/D `manualPlannedToolChanges`. */
  manualPlannedReplacements?: number;
}

export interface WheelChangeAccountingInput {
  /** Segmenty v POŘADÍ `GrindingFeature.sequence`. */
  segments: readonly WheelUsageSegment[];
  quantity: number;
  wheelLifeByWheelId: ReadonlyMap<string, ToolLifeProfile>;
  wheelChangeTimeSecByWheelId: ReadonlyMap<string, number | undefined>;
}

export interface WheelChangeAccountingResult {
  /** První založení KAŽDÉHO kotouče použitého v operaci (1x na kotouč). */
  initialWheelLoads: number;
  /** Výměna MEZI dvěma po sobě jdoucími featury s různým `wheelProfileId`. */
  interFeatureWheelChanges: number;
  /** Výměny kvůli opotřebení BĚHEM dávky (nad rámec prvního založení),
   *  odvozené z `ToolLifeProfile.expectedToolChanges` (kusy/minuty/objem). */
  wearReplacements: number;
  /** Ručně naplánované výměny, pokud byly zadané. */
  manualPlannedReplacements: number;
  totalWheelReplacements: number;
  totalWheelReplacementTimeMin: number;
  /** `true`, pokud aspoň JEDEN kotouč měl `manualPlannedReplacements`. */
  manuallyOverridden: boolean;
  /** Kotouče použité v operaci, jejichž `ToolLifeProfile.isUnknown`. */
  wheelIdsWithUnknownLife: string[];
}

/**
 * `accountForWheelReplacements` (AP-MCE-001 Fáze E §8/§9) - ČISTÁ funkce,
 * žádné I/O. Stejná struktura jako Fáze C/D `accountForToolChanges` (§8
 * "Orovnání nesmí být zaměněno za výměnu kotouče" - tahle funkce počítá
 * VÝHRADNĚ výměny KOTOUČE, orovnání řeší samostatně `wheel-dressing-
 * strategy.ts`, výsledky se NIKDY nesčítají do jednoho čísla).
 */
export function accountForWheelReplacements(input: WheelChangeAccountingInput): WheelChangeAccountingResult {
  let initialWheelLoads = 0;
  let interFeatureWheelChanges = 0;
  let initialAndInterFeatureChangeTimeMin = 0;
  let previousWheelId: string | undefined;

  for (const segment of input.segments) {
    if (segment.wheelProfileId === undefined) {
      previousWheelId = undefined;
      continue;
    }
    const changeTimeMin = (input.wheelChangeTimeSecByWheelId.get(segment.wheelProfileId) ?? 0) / 60;
    if (previousWheelId === undefined) {
      initialWheelLoads += 1;
      initialAndInterFeatureChangeTimeMin += changeTimeMin;
    } else if (segment.wheelProfileId !== previousWheelId) {
      interFeatureWheelChanges += 1;
      initialAndInterFeatureChangeTimeMin += changeTimeMin;
    }
    previousWheelId = segment.wheelProfileId;
  }

  const grindingTimePerPieceByWheel = new Map<string, number>();
  const removedVolumePerPieceByWheel = new Map<string, number>();
  const manualOverrideByWheel = new Map<string, number>();
  for (const segment of input.segments) {
    if (!segment.wheelProfileId) continue;
    grindingTimePerPieceByWheel.set(segment.wheelProfileId, (grindingTimePerPieceByWheel.get(segment.wheelProfileId) ?? 0) + segment.grindingTimePerPieceMin);
    removedVolumePerPieceByWheel.set(
      segment.wheelProfileId,
      (removedVolumePerPieceByWheel.get(segment.wheelProfileId) ?? 0) + segment.removedVolumePerPieceMm3
    );
    if (segment.manualPlannedReplacements !== undefined) {
      manualOverrideByWheel.set(segment.wheelProfileId, (manualOverrideByWheel.get(segment.wheelProfileId) ?? 0) + segment.manualPlannedReplacements);
    }
  }

  const wheelIdsWithUnknownLife = [...grindingTimePerPieceByWheel.keys()].filter((wheelId) => input.wheelLifeByWheelId.get(wheelId)?.isUnknown !== false);

  let wearReplacements = 0;
  let wearChangeTimeMin = 0;
  let manualPlannedReplacements = 0;
  let manualChangeTimeMin = 0;
  for (const [wheelId, grindingTimePerPiece] of grindingTimePerPieceByWheel) {
    const changeTimeMin = (input.wheelChangeTimeSecByWheelId.get(wheelId) ?? 0) / 60;
    const manualOverride = manualOverrideByWheel.get(wheelId);
    if (manualOverride !== undefined) {
      manualPlannedReplacements += manualOverride;
      manualChangeTimeMin += manualOverride * changeTimeMin;
      continue;
    }
    const wheelLife = input.wheelLifeByWheelId.get(wheelId);
    if (!wheelLife) continue;
    const expected = wheelLife.expectedToolChanges(input.quantity, grindingTimePerPiece, removedVolumePerPieceByWheel.get(wheelId));
    const replacements = Math.max(0, expected - 1);
    wearReplacements += replacements;
    wearChangeTimeMin += replacements * changeTimeMin;
  }

  return {
    initialWheelLoads,
    interFeatureWheelChanges,
    wearReplacements,
    manualPlannedReplacements,
    totalWheelReplacements: initialWheelLoads + interFeatureWheelChanges + wearReplacements + manualPlannedReplacements,
    totalWheelReplacementTimeMin: initialAndInterFeatureChangeTimeMin + wearChangeTimeMin + manualChangeTimeMin,
    manuallyOverridden: manualOverrideByWheel.size > 0,
    wheelIdsWithUnknownLife,
  };
}
