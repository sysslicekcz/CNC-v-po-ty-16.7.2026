import { CalculationIssue } from "@/domain/calculation-engine/entities/types";
import { TurningCalculationInput } from "@/domain/calculation-engine/turning/turning-calculation-input";
import { MillingCalculationInput } from "@/domain/calculation-engine/milling/milling-calculation-input";
import { GrindingCalculationInput } from "@/domain/calculation-engine/grinding/grinding-calculation-input";
import { CompareTurningMachinesUseCase } from "../../turning/use-cases/compare-turning-machines-use-case";
import { CompareMillingMachinesUseCase } from "../../milling/use-cases/compare-milling-machines-use-case";
import { CompareGrindingMachinesUseCase } from "../../grinding/use-cases/compare-grinding-machines-use-case";

export type GetMachineComparisonInput =
  | { operationCategory: "turning"; input: TurningCalculationInput; machineProfileIds: readonly string[]; actorId?: string; correlationId?: string }
  | { operationCategory: "milling"; input: MillingCalculationInput; machineProfileIds: readonly string[]; actorId?: string; correlationId?: string }
  | { operationCategory: "grinding"; input: GrindingCalculationInput; machineProfileIds: readonly string[]; actorId?: string; correlationId?: string };

/** Sjednocená položka srovnání (AP-MCE-001 Fáze H §15) - společný průnik
 *  polí `Turning/Milling/GrindingMachineComparisonEntry` (§15 "Kombinované
 *  skóre musí být definované v application vrstvě, ne v komponentě
 *  tabulky" - `combinedScore`/`missingCapabilityCodes` proto počítá tady,
 *  ne `MachineComparisonPage`). */
export interface MachineComparisonEntry {
  machineProfileId: string;
  blocked: boolean;
  totalOperationTimeMinutes?: number;
  confidenceScore?: number;
  timeDeltaMinutes?: number;
  confidenceDelta?: number;
  missingCapabilityCodes: readonly string[];
  issues: readonly CalculationIssue[];
  /** §15 "kombinované skóre" - nižší je lepší; `undefined` pro zablokované
   *  kandidáty. MVP váha: 70 % normalizovaný čas + 30 % (1 - confidence). */
  combinedScore?: number;
}

export type MachineComparisonSort = "fastest" | "highest_confidence" | "fewest_warnings" | "combined_score";

function withCombinedScore(entries: MachineComparisonEntry[]): MachineComparisonEntry[] {
  const usableTimes = entries.filter((e) => !e.blocked && e.totalOperationTimeMinutes !== undefined).map((e) => e.totalOperationTimeMinutes!);
  const maxTime = usableTimes.length > 0 ? Math.max(...usableTimes) : 0;
  return entries.map((e) => {
    if (e.blocked || e.totalOperationTimeMinutes === undefined) return e;
    const normalizedTime = maxTime > 0 ? e.totalOperationTimeMinutes / maxTime : 0;
    const confidencePenalty = 1 - (e.confidenceScore ?? 0);
    return { ...e, combinedScore: normalizedTime * 0.7 + confidencePenalty * 0.3 };
  });
}

/** Seřadí podle zvoleného kritéria (AP-MCE-001 Fáze H §15) - zablokovaní
 *  kandidáti vždy na konci. */
export function sortMachineComparison(entries: readonly MachineComparisonEntry[], sort: MachineComparisonSort): MachineComparisonEntry[] {
  const [usable, blocked] = [entries.filter((e) => !e.blocked), entries.filter((e) => e.blocked)];
  const sorted = [...usable].sort((a, b) => {
    switch (sort) {
      case "fastest":
        return (a.totalOperationTimeMinutes ?? Infinity) - (b.totalOperationTimeMinutes ?? Infinity);
      case "highest_confidence":
        return (b.confidenceScore ?? 0) - (a.confidenceScore ?? 0);
      case "fewest_warnings":
        return a.issues.length - b.issues.length;
      case "combined_score":
        return (a.combinedScore ?? Infinity) - (b.combinedScore ?? Infinity);
    }
  });
  return [...sorted, ...blocked];
}

/**
 * `GetMachineComparisonQuery` (AP-MCE-001 Fáze H §15/§36) - dispatcher na
 * existující per-kategorii `Compare*MachinesUseCase` (Fáze C/D/E) podle
 * `operationCategory` - ŽÁDNÁ nová srovnávací logika, jen sjednocení tvaru
 * pro `MachineComparisonPage` a výpočet kombinovaného skóre.
 */
export class GetMachineComparisonUseCase {
  constructor(
    private readonly compareTurningMachines: CompareTurningMachinesUseCase,
    private readonly compareMillingMachines: CompareMillingMachinesUseCase,
    private readonly compareGrindingMachines: CompareGrindingMachinesUseCase
  ) {}

  async execute(input: GetMachineComparisonInput): Promise<MachineComparisonEntry[]> {
    let entries: MachineComparisonEntry[];
    switch (input.operationCategory) {
      case "turning": {
        const results = await this.compareTurningMachines.execute(input);
        entries = results.map((r) => ({ ...r, missingCapabilityCodes: [] }));
        break;
      }
      case "milling": {
        const results = await this.compareMillingMachines.execute(input);
        entries = results.map((r) => ({ ...r, missingCapabilityCodes: [] }));
        break;
      }
      case "grinding": {
        const results = await this.compareGrindingMachines.execute(input);
        entries = results;
        break;
      }
    }
    return withCombinedScore(entries);
  }
}
