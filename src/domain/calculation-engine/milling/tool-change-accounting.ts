import { ToolLifeProfile } from "../profiles/tool-life-profile";

export interface ToolUsageSegment {
  /** `undefined` = feature bez konkrétního nástroje - nezakládá výměnu. */
  toolProfileId: string | undefined;
  cuttingTimePerPieceMin: number;
  /** §9 `plannedToolChanges` PER FEATURE - explicitní PŘEPIS automatického
   *  výpočtu z opotřebení PRO NÁSTROJ TOHOHLE FEATURU. Pokud víc featurů
   *  sdílí stejný `toolProfileId` a KTERÝKOLIV z nich má vyplněné
   *  `manualPlannedToolChanges`, hodnoty se pro daný nástroj SEČTOU a
   *  nahradí jeho automatický odhad opotřebení. */
  manualPlannedToolChanges?: number;
}

export interface ToolChangeAccountingInput {
  /** Segmenty v POŘADÍ `MillingFeature.sequence` - pořadí je jediné, na čem
   *  závisí rozlišení "výměna mezi featury" vs. "stejný nástroj beze změny". */
  segments: readonly ToolUsageSegment[];
  quantity: number;
  toolLifeByToolId: ReadonlyMap<string, ToolLifeProfile>;
  toolChangeTimeSecByToolId: ReadonlyMap<string, number | undefined>;
}

export interface ToolChangeAccountingResult {
  /** §9 - první založení KAŽDÉHO nástroje použitého v operaci (1x na
   *  nástroj, ne na kus). */
  initialToolLoads: number;
  /** §9 - výměna nástroje MEZI dvěma po sobě jdoucími featury s různým
   *  `toolProfileId` (stejný nástroj ve dvou featurech za sebou žádnou
   *  výměnu nezakládá - scénář "stejný nástroj bez zbytečné výměny"). */
  interFeatureToolChanges: number;
  /** §9 - výměny kvůli opotřebení BĚHEM dávky (nad rámec prvního založení),
   *  odvozené z `ToolLifeProfile.expectedToolChanges` - `0` pro nástroje s
   *  vyplněným `manualPlannedToolChanges`. */
  wearReplacements: number;
  /** §9 - ručně naplánované výměny, pokud byly zadané. */
  manualPlannedReplacements: number;
  totalToolChanges: number;
  totalToolChangeTimeMin: number;
  /** `true`, pokud aspoň JEDEN nástroj měl `manualPlannedToolChanges` a jeho
   *  `wearReplacements` byl proto přeskočen. */
  manuallyOverridden: boolean;
  /** Nástroje použité v operaci, jejichž `ToolLifeProfile.isUnknown`. */
  toolIdsWithUnknownLife: string[];
}

/**
 * `accountForToolChanges` (AP-MCE-001 Fáze D §9) - ČISTÁ funkce, žádné I/O.
 * Stejná logika jako Fáze C `turning/tool-change-accounting.ts` (kategoricky
 * neutrální - vlastní kopie tady zabraňuje křížové závislosti mezi
 * technologickými moduly, viz §21 "TurningCalculationStrategy nebyla kvůli
 * frézování měněna"). Rozlišuje čtyři typy výměn (§9) a NIKDY nepočítá "počet
 * výměn" jako "počet použitých nástrojů".
 */
export function accountForToolChanges(input: ToolChangeAccountingInput): ToolChangeAccountingResult {
  let initialToolLoads = 0;
  let interFeatureToolChanges = 0;
  let initialAndInterFeatureChangeTimeMin = 0;
  let previousToolId: string | undefined;

  for (const segment of input.segments) {
    if (segment.toolProfileId === undefined) {
      previousToolId = undefined;
      continue;
    }
    const changeTimeMin = (input.toolChangeTimeSecByToolId.get(segment.toolProfileId) ?? 0) / 60;
    if (previousToolId === undefined) {
      initialToolLoads += 1;
      initialAndInterFeatureChangeTimeMin += changeTimeMin;
    } else if (segment.toolProfileId !== previousToolId) {
      interFeatureToolChanges += 1;
      initialAndInterFeatureChangeTimeMin += changeTimeMin;
    }
    previousToolId = segment.toolProfileId;
  }

  const cuttingTimePerPieceByTool = new Map<string, number>();
  const manualOverrideByTool = new Map<string, number>();
  for (const segment of input.segments) {
    if (!segment.toolProfileId) continue;
    cuttingTimePerPieceByTool.set(
      segment.toolProfileId,
      (cuttingTimePerPieceByTool.get(segment.toolProfileId) ?? 0) + segment.cuttingTimePerPieceMin
    );
    if (segment.manualPlannedToolChanges !== undefined) {
      manualOverrideByTool.set(segment.toolProfileId, (manualOverrideByTool.get(segment.toolProfileId) ?? 0) + segment.manualPlannedToolChanges);
    }
  }

  const toolIdsWithUnknownLife = [...cuttingTimePerPieceByTool.keys()].filter(
    (toolId) => input.toolLifeByToolId.get(toolId)?.isUnknown !== false
  );

  let wearReplacements = 0;
  let wearChangeTimeMin = 0;
  let manualPlannedReplacements = 0;
  let manualChangeTimeMin = 0;
  for (const [toolId, cuttingTimePerPiece] of cuttingTimePerPieceByTool) {
    const changeTimeMin = (input.toolChangeTimeSecByToolId.get(toolId) ?? 0) / 60;
    const manualOverride = manualOverrideByTool.get(toolId);
    if (manualOverride !== undefined) {
      manualPlannedReplacements += manualOverride;
      manualChangeTimeMin += manualOverride * changeTimeMin;
      continue;
    }
    const toolLife = input.toolLifeByToolId.get(toolId);
    if (!toolLife) continue;
    const expected = toolLife.expectedToolChanges(input.quantity, cuttingTimePerPiece);
    const replacements = Math.max(0, expected - 1);
    wearReplacements += replacements;
    wearChangeTimeMin += replacements * changeTimeMin;
  }

  return {
    initialToolLoads,
    interFeatureToolChanges,
    wearReplacements,
    manualPlannedReplacements,
    totalToolChanges: initialToolLoads + interFeatureToolChanges + wearReplacements + manualPlannedReplacements,
    totalToolChangeTimeMin: initialAndInterFeatureChangeTimeMin + wearChangeTimeMin + manualChangeTimeMin,
    manuallyOverridden: manualOverrideByTool.size > 0,
    toolIdsWithUnknownLife,
  };
}
