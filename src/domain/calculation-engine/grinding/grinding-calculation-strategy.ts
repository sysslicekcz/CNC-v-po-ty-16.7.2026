import type { OperationCategory } from "../enums/operation-category";
import { OperationCalculationInputBase } from "../contracts/operation-calculation-input";
import { CalculationContext } from "../contracts/calculation-context";
import { CalculationBreakdown } from "../entities/calculation-breakdown";
import { CalculationIssue } from "../entities/types";
import { CalculationStrategy } from "../services/calculation-strategy";
import { GrindingCalculationInput } from "./grinding-calculation-input";
import { GrindingSubtype } from "./grinding-subtype";
import { CylindricalGrindingCalculationStrategy } from "./cylindrical-grinding-calculation-strategy";
import { SurfaceGrindingCalculationStrategy } from "./surface-grinding-calculation-strategy";
import { grindingIssue } from "./grinding-issue-codes";

const SURFACE_SUBTYPES = new Set<GrindingSubtype>(["surface_reciprocating", "surface_creep_feed"]);

/**
 * `GrindingCalculationStrategy` (AP-MCE-001 Fáze E §16) - JEDINÝ grinding
 * `CalculationStrategy`, který se skutečně registruje do `CalculationStrategy
 * Registry` (Fáze A, beze změny). Důvod: `CalculationStrategyRegistry` je
 * `Map<OperationCategory, CalculationStrategy>` (JEDEN slot na kategorii,
 * viz jeho komentář "druhé volání se stejnou kategorií přepíše dřívější
 * registraci") a `OperationCategory` má jedinou hodnotu `"grinding"` (Krok 5
 * kmenová data, sdílené s `Machine`/`OperationType` - měnit tenhle uzavřený
 * enum kvůli dvěma podtypům broušení by bylo přesně to "vytváření nové
 * architektury", které zadání zakazuje). §16 přesto žádá DVĚ nezávisle
 * verzované strategie (`CylindricalGrindingCalculationStrategy` "cylindrical-
 * grinding-1.0.0", `SurfaceGrindingCalculationStrategy` "surface-grinding-
 * 1.0.0") - obě jsou plnohodnotné, samostatně použitelné a testovatelné
 * implementace `CalculationStrategy`, `GrindingCalculationStrategy` je jen
 * TENKÝ delegující obal nad nimi (§16 "Registry nesmí používat pevné
 * if/switch větvení" se týká SAMOTNÉHO REGISTRU - ten dělá čisté `Map.get/
 * set`, ŽÁDNÉ `if`; větvení podle `subtype` je uvnitř JEDNÉ registrované
 * strategie, stejný princip jako `MillingCalculationStrategy` interně
 * rozlišuje dráhové a otvorové podtypy).
 *
 * Rozhoduje se PODLE CELÉHO VSTUPU (ne podle jednotlivého featuru) -
 * válcová a rovinná bruska jsou fyzicky ROZDÍLNÉ stroje, jedna operace proto
 * nikdy nemíchá obě rodiny podtypů (na rozdíl od Fáze D, kde jedna frézka
 * zvládá všechny milling podtypy). Smíšený vstup je proto blokující chyba,
 * ne haváriové chování.
 */
export class GrindingCalculationStrategy implements CalculationStrategy {
  readonly operationCategory: OperationCategory = "grinding";
  /** Verze SAMOTNÉHO DISPATCHERU (routovací vrstva) - AUTORITATIVNÍ verze
   *  výpočetní logiky, která operaci SKUTEČNĚ spočítala, je vždy
   *  `breakdown.grindingDetail.strategyVersion` (`"cylindrical-grinding-
   *  1.0.0"`/`"surface-grinding-1.0.0"` - nese ji delegát, `CalculationResult.
   *  strategyVersion` na úrovni celého výsledku je pak už jen dispatcher,
   *  stejná redundance jako existuje mezi `CalculationResult.strategyVersion`
   *  a `breakdown.turningDetail.strategyVersion` ve Fázi C). */
  readonly strategyVersion = "grinding-dispatcher-1.0.0";

  constructor(
    private readonly cylindrical: CalculationStrategy = new CylindricalGrindingCalculationStrategy(),
    private readonly surface: CalculationStrategy = new SurfaceGrindingCalculationStrategy()
  ) {}

  private resolveDelegate(input: OperationCalculationInputBase): { delegate: CalculationStrategy; mixed: boolean } {
    const grindingInput = input as GrindingCalculationInput;
    const subtypes = (grindingInput.features ?? []).map((f) => f.subtype);
    const hasSurface = subtypes.some((s) => SURFACE_SUBTYPES.has(s));
    const hasCylindrical = subtypes.some((s) => !SURFACE_SUBTYPES.has(s));
    return { delegate: hasSurface ? this.surface : this.cylindrical, mixed: hasSurface && hasCylindrical };
  }

  validate(input: OperationCalculationInputBase, context: CalculationContext): CalculationIssue[] {
    const { delegate, mixed } = this.resolveDelegate(input);
    if (mixed) {
      return [
        grindingIssue(
          "INVALID_GRINDING_SUBTYPE",
          "Operace kombinuje válcové a rovinné brusné featury - to vyžaduje dvě samostatné operace (jiný typ brusky)."
        ),
      ];
    }
    return delegate.validate(input, context);
  }

  calculate(input: OperationCalculationInputBase, context: CalculationContext): CalculationBreakdown {
    const { delegate } = this.resolveDelegate(input);
    return delegate.calculate(input, context);
  }
}
