import { ToolLifeProfile } from "../profiles/tool-life-profile";

export interface ToolUsageSegment {
  /** `undefined` = feature bez konkrétního nástroje (např. `custom_path` bez
   *  přiřazeného profilu) - nezakládá žádnou výměnu. */
  toolProfileId: string | undefined;
  cuttingTimePerPieceMin: number;
  /** §2 `plannedToolChanges` PER FEATURE - explicitní PŘEPIS automatického
   *  výpočtu z opotřebení PRO NÁSTROJ TOHOHLE FEATURU (stejný princip
   *  přednosti jako `PassStrategy.passCount`, §4). Pokud víc featurů sdílí
   *  stejný `toolProfileId` a KTERÝKOLIV z nich má vyplněné `plannedTool
   *  Changes`, hodnoty se pro daný nástroj SEČTOU a nahradí jeho
   *  automatický odhad opotřebení. */
  manualPlannedToolChanges?: number;
}

export interface ToolChangeAccountingInput {
  /** Segmenty v POŘADÍ `TurningFeature.sequence` - pořadí je jediné, na čem
   *  závisí rozlišení "výměna mezi featury" vs. "stejný nástroj beze změny". */
  segments: readonly ToolUsageSegment[];
  quantity: number;
  toolLifeByToolId: ReadonlyMap<string, ToolLifeProfile>;
  toolChangeTimeSecByToolId: ReadonlyMap<string, number | undefined>;
}

export interface ToolChangeAccountingResult {
  /** §8 - první založení KAŽDÉHO nástroje použitého v operaci (1x na
   *  nástroj, ne na kus). */
  initialToolLoads: number;
  /** §8 - výměna nástroje MEZI dvěma po sobě jdoucími featury s různým
   *  `toolProfileId` (stejný nástroj ve dvou featurech za sebou žádnou
   *  výměnu nezakládá - scénář "stejný nástroj bez zbytečné výměny"). */
  interFeatureToolChanges: number;
  /** §8 - výměny kvůli opotřebení BĚHEM dávky (nad rámec prvního založení),
   *  odvozené z `ToolLifeProfile.expectedToolChanges` - `0` pro nástroje s
   *  vyplněným `manualPlannedToolChanges`. */
  wearReplacements: number;
  /** §8 - ručně naplánované výměny (§2 `plannedToolChanges`), pokud byly
   *  zadané. */
  manualPlannedReplacements: number;
  totalToolChanges: number;
  totalToolChangeTimeMin: number;
  /** `true`, pokud aspoň JEDEN nástroj měl `manualPlannedToolChanges` a jeho
   *  `wearReplacements` byl proto přeskočen (§8 - "Počet výměn nesmí být
   *  počítán jako počet použitých nástrojů", i tahle informace patří do
   *  breakdown). */
  manuallyOverridden: boolean;
  /** Nástroje použité v operaci, jejichž `ToolLifeProfile.isUnknown` - pro
   *  `TOOL_LIFE_UNKNOWN` warning na úrovni strategie (§12). */
  toolIdsWithUnknownLife: string[];
}

/**
 * `accountForToolChanges` (AP-MCE-001 Fáze C §8) - ČISTÁ funkce, žádné I/O.
 * Rozlišuje čtyři typy výměn (§8: "Každý typ musí být samostatně uveden v
 * breakdown") a NIKDY nepočítá "počet výměn" jako "počet použitých nástrojů" -
 * dva po sobě jdoucí featury se STEJNÝM `toolProfileId` sdílí jedno
 * `initialToolLoads` a žádnou další výměnu.
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
