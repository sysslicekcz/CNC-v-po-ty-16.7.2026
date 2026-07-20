/**
 * Geometrie jednoho `TurningFeature` (AP-MCE-001 Fáze C §2/§3) - "technologická
 * pole" ze zadání jsou PER-FEATURE (ne na úrovni celé operace), protože jedna
 * operace může kombinovat víc úseků s různou geometrií (čelní srovnání +
 * hrubovací průchod + zapíchnutí + závit, viz §3 příklady). `TurningCalculation
 * Input` (operace) nese jen společná pole (§2 "Společná pole"), tohle je tvar
 * pro `TurningFeature.geometry`.
 *
 * Pole mají různý význam podle `TurningFeature.subtype` (zdokumentováno u
 * každého):
 *  - `external_longitudinal`/`internal_longitudinal`: start/end = průměr
 *    obrobku před/po průchodu, `machiningLengthMm` = axiální délka záběru.
 *  - `facing`: start/end = VNĚJŠÍ/VNITŘNÍ průměr čelní plochy (radiální
 *    dráha), `machiningLengthMm` = axiální hloubka záběru na jeden průchod.
 *  - `drilling`: start = end = průměr vrtáku, `machiningLengthMm` = hloubka
 *    vrtání, `peckDepthMm`/`holeCount` navíc.
 *  - `grooving`/`parting`: start/end = průměr před/na dně zápichu (radiální
 *    dráha = (start-end)/2), `machiningLengthMm` = axiální šířka zápichu.
 *  - `threading`: start = jmenovitý průměr závitu, `machiningLengthMm` =
 *    délka závitu, `threadPitchMm` navíc.
 *  - `custom_path`: `customPathLengthMm`/`customPathRepeats` navíc, start
 *    slouží jen jako průměr pro odvození otáček (pokud není explicitní
 *    `cuttingConditionOverride.spindleSpeedRpm`).
 */
export interface TurningFeatureGeometry {
  startDiameterMm: number;
  endDiameterMm: number;
  machiningLengthMm: number;
  radialAllowanceMm?: number;
  axialAllowanceMm?: number;
  approachLengthMm: number;
  retractLengthMm: number;

  /** `threading` - stoupání závitu v mm/otáčku. */
  threadPitchMm?: number;
  /** `drilling` - hloubka jednoho pecku (undefined = bez peckování, jeden
   *  souvislý záběr do plné hloubky). */
  peckDepthMm?: number;
  /** `drilling` - počet stejných otvorů ve featuru (výchozí 1). */
  holeCount?: number;
  /** `custom_path` - explicitní délka dráhy nástroje, nahrazuje odvození
   *  z diametrů/délky. */
  customPathLengthMm?: number;
  /** `custom_path` - kolikrát se dráha opakuje (výchozí 1). */
  customPathRepeats?: number;
}
