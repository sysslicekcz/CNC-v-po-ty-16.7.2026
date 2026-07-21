/**
 * Vstup pro `resolveCylindricalPassStrategy()`/`resolveSurfacePassStrategy()`
 * (AP-MCE-001 Fáze E §4) - nese buď explicitní `passCount`, nebo dost údajů
 * na automatický odvození z přídavku a hloubky záběru. Explicitní `passCount`
 * má vždy přednost (§4 "Explicitní passCount má přednost, ale musí být uložen
 * warning nebo information o ručním zadání").
 */
export interface GrindingPassStrategyInput {
  /** Explicitní POČET VŠECH průchodů (hrubovacích i dokončovacích, BEZ
   *  jiskřicích - ty se vždy přičítají zvlášť přes `sparkOutPasses`, i při
   *  explicitním zadání) - pokud je zadaný, automatický výpočet se přeskočí. */
  passCount?: number;
  /** Válcová rodina (§4) - hloubka záběru jednoho hrubovacího průchodu (mm
   *  na poloměr). */
  roughingInfeedPerPassMm?: number;
  /** Válcová rodina - hloubka záběru jednoho dokončovacího průchodu (mm na
   *  poloměr). */
  finishingInfeedPerPassMm?: number;
  /** Přídavek ponechaný na dokončení (mm na poloměr) - válcová rodina. */
  finishingAllowanceMm?: number;
  /** Jiskřicí/korekční průchody navíc (nulový posuv) - obě rodiny, výchozí 0. */
  sparkOutPasses?: number;
  /** Rovinná rodina (§4/§6) - hloubka jednoho hloubkového záběru (mm). */
  infeedPerPassMm?: number;
  /** Rovinná rodina - efektivní příčný posuv (mm) použitý pro
   *  `crossPasses = ceil(surfaceWidthMm / effectiveCrossFeedMm)`. */
  crossFeedMm?: number;
  /** Rovinná rodina - kolik stolových zdvihů (tam+zpět) připadá na JEDNU
   *  příčnou pozici v jedné hloubkové vrstvě - výchozí 2 (tam + zpět). */
  strokesPerPass?: number;
}
