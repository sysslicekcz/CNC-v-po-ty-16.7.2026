import type { MachiningMode } from "./turning-subtype";
import { TurningPassStrategyInput } from "./turning-pass-strategy-input";

export interface PassStrategyResolution {
  roughingPasses: number;
  finishingPasses: number;
  springPasses: number;
  totalPasses: number;
  /** §4 - `true`, pokud volající zadal explicitní `passCount` (přednost před
   *  automatickým výpočtem, ale výsledek MUSÍ nést tuhle informaci - MANUAL_
   *  PASS_COUNT_USED warning na úrovni strategie). */
  passCountManuallySpecified: boolean;
  /** Přídavek/úběr, ze kterého se počet průchodů odvodil - RADIÁLNÍ pro
   *  podélné soustružení/zapichování/upichování, AXIÁLNÍ pro čelní
   *  soustružení (§6 - facing odebírá stock ve směru Z, ne na poloměru). */
  stockToRemoveMm: number;
  /** `true`, pokud automatický výpočet hrubovacích průchodů použil výchozí
   *  hloubku řezu (chybějící `roughingDepthOfCutMm` na vstupu) - strategie
   *  z toho udělá warning + sníží confidence. */
  usedDefaultRoughingDepthOfCut: boolean;
}

const FALLBACK_ROUGHING_DEPTH_OF_CUT_MM = 1;

/**
 * `PassStrategy` (AP-MCE-001 Fáze C §4) - ČISTÁ funkce, žádné I/O. Počet
 * průchodů závisí na `machiningMode` FEATURU (ne na kombinaci uvnitř jednoho
 * featuru - hrubování a dokončení stejné plochy jsou dva SAMOSTATNÉ
 * `TurningFeature` za sebou, viz §3 příklady "hrubovací průchod" +
 * "dokončovací průchod" jako dvě položky):
 *  - `roughing`: `roughingPasses = ceil(max(0, stockToRemove - finishingAllowance) / roughingDepthOfCut)`,
 *    `finishingPasses = 0`.
 *  - `semi_finishing`/`finishing`: `finishingPasses` (výchozí 1), `roughingPasses = 0`
 *    - celý zbylý přídavek featuru se odebere dokončovacím průchodem/průchody.
 *
 * `stockToRemoveMm` je záměrně obecné jméno, ne `radialStockMm` - volající
 * (per-subtype kalkulátor v `turning-feature-cutting.ts`) mu předá RADIÁLNÍ
 * úběr pro podélné soustružení/zapichování/upichování, ale AXIÁLNÍ úběr pro
 * čelní soustružení (facing odebírá materiál ve směru Z, viz §6).
 *
 * Explicitní `passCount` má vždy přednost (§4), ale výsledek nese
 * `passCountManuallySpecified: true`, aby o tom `TurningCalculationStrategy`
 * mohla vytvořit `MANUAL_PASS_COUNT_USED` informaci.
 */
export function resolvePassStrategy(
  stockToRemoveMm: number,
  machiningMode: MachiningMode,
  input: TurningPassStrategyInput
): PassStrategyResolution {
  const springPasses = input.springPassCount ?? 0;

  if (input.passCount !== undefined) {
    const roughingPasses = machiningMode === "roughing" ? input.passCount : 0;
    const finishingPasses = machiningMode === "roughing" ? 0 : input.passCount;
    return {
      roughingPasses,
      finishingPasses,
      springPasses,
      totalPasses: roughingPasses + finishingPasses + springPasses,
      passCountManuallySpecified: true,
      stockToRemoveMm,
      usedDefaultRoughingDepthOfCut: false,
    };
  }

  if (machiningMode === "roughing") {
    const finishingAllowance = input.finishingAllowanceMm ?? 0;
    const remainingStock = Math.max(0, stockToRemoveMm - finishingAllowance);
    const usedDefaultRoughingDepthOfCut = !input.roughingDepthOfCutMm || input.roughingDepthOfCutMm <= 0;
    const depthOfCut = usedDefaultRoughingDepthOfCut ? FALLBACK_ROUGHING_DEPTH_OF_CUT_MM : input.roughingDepthOfCutMm!;
    const roughingPasses = remainingStock === 0 ? 0 : Math.ceil(remainingStock / depthOfCut);
    return {
      roughingPasses,
      finishingPasses: 0,
      springPasses,
      totalPasses: roughingPasses + springPasses,
      passCountManuallySpecified: false,
      stockToRemoveMm,
      usedDefaultRoughingDepthOfCut: roughingPasses > 0 && usedDefaultRoughingDepthOfCut,
    };
  }

  const finishingPasses = input.finishingPasses ?? 1;
  return {
    roughingPasses: 0,
    finishingPasses,
    springPasses,
    totalPasses: finishingPasses + springPasses,
    passCountManuallySpecified: false,
    stockToRemoveMm,
    usedDefaultRoughingDepthOfCut: false,
  };
}
