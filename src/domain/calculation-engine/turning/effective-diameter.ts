import type { TurningSubtype } from "./turning-subtype";

/** Odkud pochází efektivní průměr použitý pro odvození otáček (AP-MCE-001
 *  Fáze C §5) - `SpindleSpeedSource` v breakdown featuru (§9). */
export type EffectiveDiameterSource = "start" | "end" | "average" | "segment" | "explicit";

export interface ResolveEffectiveDiameterInput {
  subtype: TurningSubtype;
  startDiameterMm: number;
  endDiameterMm: number;
  /** §5 "explicit diameter override" - vyhraje nad výchozím pravidlem podle
   *  subtype, pokud je zadaný. */
  explicitDiameterOverrideMm?: number;
}

export interface ResolvedEffectiveDiameter {
  diameterMm: number;
  source: EffectiveDiameterSource;
}

/**
 * Výchozí pravidlo pro efektivní průměr podle `subtype` (AP-MCE-001 Fáze C
 * §5):
 *  - podélné soustružení (vnější i vnitřní): PRŮMĚRNÝ průměr úseku.
 *  - čelní soustružení: MVP zjednodušení - průměrovaný průměr (zadání
 *    výslovně připouští "segmentové NEBO průměrované podle pravidel MVP").
 *  - vrtání: průměr vrtáku (`geometry.startDiameterMm`, `TurningFeatureFactory`/
 *    volající nastaví `startDiameterMm === endDiameterMm` pro vrtání).
 *  - zapichování/upichování: "aktuální průměr v místě řezu" - diskrétní
 *    výpočet nesimuluje polohu za polohou, MVP proto použije stejný průměr
 *    jako podélné soustružení (matematicky `average`), ale se ZVLÁŠTNÍM
 *    zdrojem `"segment"`, aby breakdown rozlišil "toto je zjednodušení
 *    plynulé změny průměru", ne totéž pravidlo jako podélný průchod.
 *  - závit: jmenovitý (počáteční) průměr závitu.
 *  - custom_path: počáteční průměr jako záložní hodnota (typicky se použije
 *    `explicitDiameterOverrideMm`, protože dráha nemusí být rotačně
 *    symetrická).
 */
export function resolveEffectiveDiameterMm(input: ResolveEffectiveDiameterInput): ResolvedEffectiveDiameter {
  if (input.explicitDiameterOverrideMm !== undefined) {
    return { diameterMm: input.explicitDiameterOverrideMm, source: "explicit" };
  }

  switch (input.subtype) {
    case "external_longitudinal":
    case "internal_longitudinal":
    case "facing":
      return { diameterMm: (input.startDiameterMm + input.endDiameterMm) / 2, source: "average" };
    case "grooving":
    case "parting":
      return { diameterMm: (input.startDiameterMm + input.endDiameterMm) / 2, source: "segment" };
    case "drilling":
    case "threading":
    case "custom_path":
      return { diameterMm: input.startDiameterMm, source: "start" };
  }
}
