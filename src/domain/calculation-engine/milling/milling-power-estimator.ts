export interface MillingPowerEstimateInput {
  widthOfCutMm: number;
  depthOfCutMm: number;
  feedRateMmMin: number;
  toolDiameterMm: number;
  /** `MaterialProfile.materialCoefficient` - jediný signál o obrobitelnosti,
   *  který má MVP model k dispozici (stejné zjednodušení jako Fáze C). */
  materialCoefficient: number;
}

export interface MillingPowerEstimate {
  requiredPowerKw: number;
}

/**
 * `MillingPowerEstimator` (AP-MCE-001 Fáze D §8) - rozhraní ODDĚLENÉ od
 * implementace přesně proto, aby pozdější fáze mohla dosadit fyzikálně
 * přesnější model BEZE ZMĚNY `MillingCalculationStrategy` - ta zná jen tohle
 * rozhraní, ne konkrétní třídu (dependency inversion, stejný princip jako
 * Fáze C `TurningPowerEstimator`).
 */
export interface MillingPowerEstimator {
  estimate(input: MillingPowerEstimateInput): MillingPowerEstimate;
}

/**
 * MVP odhad výkonové zátěže (AP-MCE-001 Fáze D §8 "MVP odhad podle materiálu,
 * widthOfCut, depthOfCut, feedRate, toolDiameter, machiningMode") - standardní
 * vzorec pro frézovací výkon:
 *
 *     Pc [kW] = (ae[mm] × ap[mm] × vf[mm/min] × kc[N/mm²]) / (60 × 10⁶)
 *
 * kde `ae` = radiální záběr (`widthOfCutMm`), `ap` = axiální záběr
 * (`depthOfCutMm`), `vf` = rychlost posuvu. `kc` (měrná řezná síla) je
 * nahrazená JEDINOU konstantou `BASE_SPECIFIC_CUTTING_FORCE_N_PER_MM2`
 * škálovanou `MaterialProfile.materialCoefficient` - stejné vědomé
 * zjednodušení rozsahu jako Fáze C `MvpTurningPowerEstimator` (`toolDiameterMm`
 * je součástí rozhraní pro budoucí přesnější model - MVP ho v samotném
 * vzorci nepoužívá, `ae`/`ap`/`vf` samy o sobě dostatečně určují MRR).
 */
export class MvpMillingPowerEstimator implements MillingPowerEstimator {
  private static readonly BASE_SPECIFIC_CUTTING_FORCE_N_PER_MM2 = 2000;

  estimate(input: MillingPowerEstimateInput): MillingPowerEstimate {
    const specificCuttingForce = MvpMillingPowerEstimator.BASE_SPECIFIC_CUTTING_FORCE_N_PER_MM2 * input.materialCoefficient;
    const requiredPowerKw = (input.widthOfCutMm * input.depthOfCutMm * input.feedRateMmMin * specificCuttingForce) / 60_000_000;
    return { requiredPowerKw };
  }
}
