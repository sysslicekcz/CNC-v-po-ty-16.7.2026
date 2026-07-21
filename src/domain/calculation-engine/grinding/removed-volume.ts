/**
 * Zjednodušený odhad odebraného objemu (AP-MCE-001 Fáze E §10) - POUŽITÍ:
 * odhad zátěže/opotřebení kotouče a kontrola nesmyslných parametrů, NIKDY
 * jako jediný zdroj času (§10: "Nepoužívej objem jako jediný zdroj času" -
 * skutečný čas počítají `cylindrical-time.ts`/`surface-time.ts` z posuvu a
 * rychlosti, ne z objemu).
 */

/** Válcová plocha (§10 přesná formule): `π × grindingLengthMm × |D₁² - D₂²| / 4`. */
export function cylindricalRemovedVolumeMm3(grindingLengthMm: number, startDiameterMm: number, endDiameterMm: number): number {
  return (Math.PI * grindingLengthMm * Math.abs(startDiameterMm ** 2 - endDiameterMm ** 2)) / 4;
}

/** Rovinné broušení (§10 přesná formule): `surfaceLengthMm × surfaceWidthMm × stockAllowanceMm`. */
export function surfaceRemovedVolumeMm3(surfaceLengthMm: number, surfaceWidthMm: number, stockAllowanceMm: number): number {
  return surfaceLengthMm * surfaceWidthMm * stockAllowanceMm;
}
