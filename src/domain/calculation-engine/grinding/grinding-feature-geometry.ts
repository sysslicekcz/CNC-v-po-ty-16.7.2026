/**
 * Geometrie jednoho `GrindingFeature` (AP-MCE-001 Fáze E §2/§3) - stejný
 * princip jako Fáze C/D (technologická pole PER FEATURE, ne na úrovni celé
 * operace - jedna operace může kombinovat vnější průměr + osazení + čelo +
 * zápich, viz §3 příklady).
 *
 * Pole mají různý význam podle `GrindingFeature.subtype`:
 *  - `external_cylindrical`/`internal_cylindrical`/`plunge_grinding`/
 *    `traverse_grinding`/centerless rodina: `startDiameterMm`/`endDiameterMm`
 *    = průměr obrobku před/po broušení, `grindingLengthMm` = axiální délka
 *    záběru.
 *  - `face_grinding`: `startDiameterMm` = vnější průměr čela, `axialAllowanceMm`
 *    = přídavek na broušené čelo.
 *  - `surface_reciprocating`/`surface_creep_feed`: `surfaceLengthMm`/
 *    `surfaceWidthMm` = rozměry broušené plochy.
 *  - `custom_path`: použije buď válcová, nebo rovinná pole podle toho, co je
 *    vyplněné.
 */
export interface GrindingFeatureGeometry {
  startDiameterMm?: number;
  endDiameterMm?: number;
  grindingLengthMm?: number;
  surfaceLengthMm?: number;
  surfaceWidthMm?: number;
  /** Celkový přídavek na stranu (mm) - obecné pole platné pro OBĚ rodiny,
   *  §2 "stockAllowanceMm" (na rozdíl od `radialAllowanceMm`/`axialAllowanceMm`,
   *  které rozlišují SMĚR přídavku u válcové rodiny). */
  stockAllowanceMm: number;
  radialAllowanceMm?: number;
  axialAllowanceMm?: number;
  approachLengthMm: number;
  retractLengthMm: number;
  dwellTimeSec?: number;
}
