/**
 * Vstup pro `resolvePassStrategy()` (AP-MCE-001 Fáze C §4) - nese buď
 * explicitní `passCount`, nebo dost údajů na automatický odvození z přídavku
 * a hloubky řezu. Obojí smí být zadané současně - `passCount` má vždy
 * přednost (§4: "U explicitního passCount má explicitní hodnota přednost"),
 * zbytek polí se pak jen uloží jako informace, ne jako vstup do výpočtu.
 */
export interface TurningPassStrategyInput {
  /** Explicitní POČET VŠECH průchodů (hrubovacích i dokončovacích
   *  dohromady) - pokud je zadaný, automatický výpočet se přeskočí a
   *  výsledek nese `passCountManuallySpecified: true` (§4). */
  passCount?: number;
  /** Hloubka řezu jednoho hrubovacího průchodu (mm na poloměr) - nutná pro
   *  automatický výpočet `roughingPasses`. */
  roughingDepthOfCutMm?: number;
  /** Přídavek ponechaný na dokončení (mm na poloměr) - odečítá se od
   *  celkového radiálního úběru PŘED dělením hrubovací hloubkou řezu. */
  finishingAllowanceMm?: number;
  /** Počet dokončovacích průchodů (výchozí 1, pokud `machiningMode` featuru
   *  není `"roughing"`, jinak 0). */
  finishingPasses?: number;
  /** Jiskřicí/korekční průchody navíc (§4) - výchozí 0. */
  springPassCount?: number;
}
