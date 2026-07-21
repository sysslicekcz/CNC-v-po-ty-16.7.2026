/**
 * Geometrie jednoho `MillingFeature` (AP-MCE-001 Fáze D §2/§3) - "technologická
 * pole" ze zadání jsou PER-FEATURE (ne na úrovni celé operace), protože jedna
 * operace může kombinovat víc úseků s různou geometrií (srovnání roviny +
 * hrubování kapsy + obvodová kontura + vrtání, viz §3 příklady). Pole mají
 * různý význam podle `MillingFeature.subtype` (zdokumentováno u každého):
 *
 *  - `face_milling`: `areaLengthMm`/`areaWidthMm` = rozměry obráběné plochy.
 *  - `pocket_milling`: `pocketLengthMm`/`pocketWidthMm`/`pocketDepthMm`.
 *  - `contour_milling`: `contourLengthMm` = délka obvodové dráhy.
 *  - `slot_milling`: `slotLengthMm`/`slotWidthMm`, hloubka sdílená s
 *    `machiningDepthMm` (drážka je jen "úzká kapsa").
 *  - `drilling`/`countersinking`/`reaming`/`threading`: `machiningDepthMm` =
 *    hloubka otvoru, `peckDepthMm`/`holeCount`/`threadPitchMm` navíc.
 *  - `two_d`/`two_and_half_d`/`custom_path`: `pathLengthMm` = explicitní délka
 *    dráhy (§4 "explicitní dráha"), `two_and_half_d` navíc opakuje dráhu přes
 *    `machiningDepthMm`/krok `stepDownMm` (viz `pathStrategy`).
 *  - `three_d`: `areaLengthMm`/`areaWidthMm` + `machiningDepthMm` jako vstup
 *    do ZJEDNODUŠENÉHO MVP modelu (§4 "nepředstírej přesnou CAM simulaci").
 */
export interface MillingFeatureGeometry {
  pathLengthMm?: number;
  areaLengthMm?: number;
  areaWidthMm?: number;
  pocketLengthMm?: number;
  pocketWidthMm?: number;
  pocketDepthMm?: number;
  contourLengthMm?: number;
  slotLengthMm?: number;
  slotWidthMm?: number;
  machiningDepthMm?: number;
  stockAllowanceRadialMm?: number;
  stockAllowanceAxialMm?: number;
  approachLengthMm: number;
  retractLengthMm: number;

  /** `drilling`/`countersinking`/`reaming` - hloubka jednoho pecku
   *  (`undefined` = bez peckování). */
  peckDepthMm?: number;
  /** `drilling`/`countersinking`/`reaming`/`threading` - počet stejných
   *  otvorů ve featuru (výchozí 1). */
  holeCount?: number;
  /** `threading` - stoupání závitu v mm/otáčku. */
  threadPitchMm?: number;
}
