import { CalculationIssue } from "@/domain/calculation-engine/entities/types";
import { TurningCalculationInput } from "@/domain/calculation-engine/turning/turning-calculation-input";
import { MillingCalculationInput } from "@/domain/calculation-engine/milling/milling-calculation-input";
import { GrindingCalculationInput } from "@/domain/calculation-engine/grinding/grinding-calculation-input";
import { CompareTurningToolsUseCase } from "../../turning/use-cases/compare-turning-tools-use-case";
import { CompareMillingToolsUseCase } from "../../milling/use-cases/compare-milling-tools-use-case";
import { CompareGrindingWheelsUseCase } from "../../grinding/use-cases/compare-grinding-wheels-use-case";

export type GetToolComparisonInput =
  | { operationCategory: "turning"; input: TurningCalculationInput; featureId: string; toolProfileIds: readonly string[]; actorId?: string; correlationId?: string }
  | { operationCategory: "milling"; input: MillingCalculationInput; featureId: string; toolProfileIds: readonly string[]; actorId?: string; correlationId?: string }
  | { operationCategory: "grinding"; input: GrindingCalculationInput; featureId: string; toolProfileIds: readonly string[]; actorId?: string; correlationId?: string };

/** Sjednocená položka srovnání nástrojů (AP-MCE-001 Fáze H §16) - u
 *  broušení "nástroj" znamená brusný kotouč (`GrindingWheelComparisonEntry`),
 *  §16 explicitně cenu/náklad na kus nechává nepovinnou a "není k
 *  dispozici", pokud data nestačí - `estimatedCostPerPieceMinor` proto
 *  vždy `undefined` (žádný cenový modul v projektu zatím neexistuje, viz
 *  audit Fáze H §1). */
export interface ToolComparisonEntry {
  toolProfileId: string;
  blocked: boolean;
  totalOperationTimeMinutes?: number;
  cuttingTimeMinutes?: number;
  toolChangeCount?: number;
  confidenceScore?: number;
  timeDeltaMinutes?: number;
  confidenceDelta?: number;
  estimatedCostPerPieceMinor?: number;
  issues: readonly CalculationIssue[];
}

/**
 * `GetToolComparisonQuery` (AP-MCE-001 Fáze H §16/§36) - dispatcher na
 * existující per-kategorii `Compare*ToolsUseCase`/`CompareGrindingWheelsUseCase`
 * (Fáze C/D/E), stejný princip jako `GetMachineComparisonQuery`. Žádnou
 * finanční kalkulaci NEDOPOČÍTÁVÁ (§16 "Nevytvářej finanční výpočty z
 * neúplných dat") - `estimatedCostPerPieceMinor` zůstává `undefined`.
 */
export class GetToolComparisonUseCase {
  constructor(
    private readonly compareTurningTools: CompareTurningToolsUseCase,
    private readonly compareMillingTools: CompareMillingToolsUseCase,
    private readonly compareGrindingWheels: CompareGrindingWheelsUseCase
  ) {}

  async execute(input: GetToolComparisonInput): Promise<ToolComparisonEntry[]> {
    switch (input.operationCategory) {
      case "turning": {
        const results = await this.compareTurningTools.execute(input);
        return results.map((r) => ({ ...r }));
      }
      case "milling": {
        const results = await this.compareMillingTools.execute(input);
        return results.map((r) => ({ ...r }));
      }
      case "grinding": {
        const results = await this.compareGrindingWheels.execute({ ...input, wheelProfileIds: input.toolProfileIds });
        return results.map((r) => ({ ...r, toolProfileId: r.wheelProfileId, cuttingTimeMinutes: undefined, toolChangeCount: undefined }));
      }
    }
  }
}
