export interface GrindingPowerEstimateInput {
  /** Míra odběru materiálu (mm³/min) - `removedVolumeMm3 / rawGrindingTimeMin`,
   *  dopočítá volající (`CylindricalGrindingCalculationStrategy`/`SurfaceGrinding
   *  CalculationStrategy`), viz `removed-volume.ts` (§10 "Využij jej pro odhad
   *  zátěže", NIKDY jako jediný zdroj ČASU - tady je legitimním vstupem VÝKONU). */
  materialRemovalRateMm3PerMin: number;
  /** `MaterialProfile.materialCoefficient` - jediný signál o obrobitelnosti,
   *  který má MVP model k dispozici (stejné zjednodušení jako Fáze C/D). */
  materialCoefficient: number;
}

export interface GrindingPowerEstimate {
  requiredPowerKw: number;
}

/**
 * `GrindingPowerEstimator` (AP-MCE-001 Fáze E §9) - rozhraní ODDĚLENÉ od
 * implementace, stejný důvod jako Fáze C `TurningPowerEstimator`/Fáze D
 * `MillingPowerEstimator` (dependency inversion - pozdější fáze může dosadit
 * fyzikálně přesnější model beze změny strategie).
 */
export interface GrindingPowerEstimator {
  estimate(input: GrindingPowerEstimateInput): GrindingPowerEstimate;
}

/**
 * MVP odhad výkonové zátěže broušení (AP-MCE-001 Fáze E §9) - broušení je
 * energeticky výrazně méně efektivní než třískové obrábění (většina energie
 * se mění v teplo, ne v odebraný objem), MVP proto použije "měrnou brusnou
 * energii" (J/mm³, řádově vyšší než `kc1` u soustružení/frézování):
 *
 *     P [kW] = MRR[mm³/min] × specificGrindingEnergy[J/mm³] / 60 000
 *
 * `specificGrindingEnergy` je nahrazená JEDINOU konstantou `BASE_SPECIFIC_
 * GRINDING_ENERGY_J_PER_MM3` škálovanou `MaterialProfile.materialCoefficient` -
 * stejné vědomé zjednodušení rozsahu jako Fáze C/D power estimátory.
 */
export class MvpGrindingPowerEstimator implements GrindingPowerEstimator {
  private static readonly BASE_SPECIFIC_GRINDING_ENERGY_J_PER_MM3 = 35;

  estimate(input: GrindingPowerEstimateInput): GrindingPowerEstimate {
    const specificGrindingEnergy = MvpGrindingPowerEstimator.BASE_SPECIFIC_GRINDING_ENERGY_J_PER_MM3 * input.materialCoefficient;
    const requiredPowerKw = (input.materialRemovalRateMm3PerMin * specificGrindingEnergy) / 60_000;
    return { requiredPowerKw };
  }
}
