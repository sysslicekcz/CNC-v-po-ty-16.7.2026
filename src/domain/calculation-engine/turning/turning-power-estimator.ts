export interface TurningPowerEstimateInput {
  cuttingSpeedMMin: number;
  depthOfCutMm: number;
  feedPerRevolutionMm: number;
  /** `MaterialProfile.materialCoefficient` - jediný signál o obrobitelnosti,
   *  který má MVP model k dispozici (žádná databáze měrné řezné síly `kc1`
   *  podle materiálu zatím neexistuje, viz komentář u `MvpTurningPowerEstimator`). */
  materialCoefficient: number;
}

export interface TurningPowerEstimate {
  requiredPowerKw: number;
}

/**
 * `TurningPowerEstimator` (AP-MCE-001 Fáze C §7) - rozhraní ODDĚLENÉ od
 * implementace přesně proto, aby pozdější fáze mohla dosadit fyzikálně
 * přesnější model (skutečná měrná řezná síla `kc1` podle materiálové
 * skupiny/tvrdosti, úhel čela nástroje, ...) BEZE ZMĚNY
 * `TurningCalculationStrategy` - ta zná jen tohle rozhraní, ne konkrétní třídu
 * (dependency inversion, stejný princip jako `CalculationStrategyRegistry`).
 */
export interface TurningPowerEstimator {
  estimate(input: TurningPowerEstimateInput): TurningPowerEstimate;
}

/**
 * MVP odhad výkonové zátěže (AP-MCE-001 Fáze C §7 "MVP odhad výkonové
 * zátěže") - zjednodušený vzorec pro řezný výkon soustružení:
 *
 *     P [kW] = (Vc[m/min] × ap[mm] × f[mm/ot] × kc1[N/mm²]) / 60 000
 *
 * `kc1` (měrná řezná síla) je nahrazená JEDINOU konstantou `BASE_SPECIFIC_
 * CUTTING_FORCE_N_PER_MM2` škálovanou `MaterialProfile.materialCoefficient`
 * (vyšší koeficient = obtížněji obrobitelný materiál = vyšší odhadovaná
 * řezná síla) - vědomé zjednodušení rozsahu (přesná `kc1` tabulka podle
 * materiálové skupiny/tvrdosti je mimo MVP, viz AP-MCE-001 Fáze C §7 "zatím
 * nemusí být dokonale fyzikálně přesný").
 */
export class MvpTurningPowerEstimator implements TurningPowerEstimator {
  private static readonly BASE_SPECIFIC_CUTTING_FORCE_N_PER_MM2 = 2000;

  estimate(input: TurningPowerEstimateInput): TurningPowerEstimate {
    const specificCuttingForce = MvpTurningPowerEstimator.BASE_SPECIFIC_CUTTING_FORCE_N_PER_MM2 * input.materialCoefficient;
    const requiredPowerKw = (input.cuttingSpeedMMin * input.depthOfCutMm * input.feedPerRevolutionMm * specificCuttingForce) / 60_000;
    return { requiredPowerKw };
  }
}
