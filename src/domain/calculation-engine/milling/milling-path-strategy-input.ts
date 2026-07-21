/**
 * Vstup pro `resolveMillingPath()` (AP-MCE-001 Fáze D §4) - řídí, jak se
 * z geometrie featuru odvodí efektivní délka dráhy nástroje a počet
 * hloubkových/bočních záběrů. Explicitní `pathLengthMm` (v `geometry`) má
 * vždy přednost před jakýmkoliv odvozením (§4 "explicitní dráha").
 */
export interface MillingPathStrategyInput {
  /** Efektivní boční krok (mm) - výchozí `0.7 × toolDiameterMm`, pokud
   *  chybí (MVP konstanta, zdokumentovaná u `resolveMillingPath`). */
  stepOverMm?: number;
  /** Hloubka jednoho hloubkového záběru (mm) - výchozí 1 mm (stejná MVP
   *  konvence jako Fáze C `roughingDepthOfCutMm`). */
  stepDownMm?: number;
  /** Koeficient složitosti pro 3D aproximaci (§4 "podle ... složitosti") -
   *  výchozí 1.5 (dráha po ploše je vždy delší než prostý raster). */
  complexityFactor?: number;
}

/**
 * Vstup pro počet PRŮCHODŮ CELÉ dráhy (na rozdíl od hloubkových/bočních
 * záběrů, které řeší `MillingPathStrategyInput`) - stejný princip jako Fáze C
 * `TurningPassStrategyInput`: explicitní `passCount` má vždy přednost.
 */
export interface MillingPassStrategyInput {
  /** Explicitní počet průchodů CELÉ dráhy - přeskočí automatické odvození
   *  (§4/§2 "passCount"), výsledek nese `passCountManuallySpecified: true`. */
  passCount?: number;
  /** Přídavek ponechaný na dokončení (mm), odečítá se před určením počtu
   *  hrubovacích hloubkových záběrů - stejná role jako Fáze C
   *  `finishingAllowanceMm`. */
  finishingAllowanceMm?: number;
  /** Počet dokončovacích/obvodových průchodů (výchozí 1 pro semi_finishing/
   *  finishing, 0 pro roughing). */
  finishingPasses?: number;
  /** Jiskřicí/korekční průchody navíc - výchozí 0. */
  springPassCount?: number;
}
