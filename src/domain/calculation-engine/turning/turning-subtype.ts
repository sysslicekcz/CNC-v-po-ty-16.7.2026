/**
 * Podporované technologické podtypy soustružení (AP-MCE-001 Fáze C §2) -
 * jeden `TurningFeature` má vždy přesně jeden `subtype`, operace (víc
 * `TurningFeature` za sebou) může kombinovat libovolně (§3: "více
 * technologických úseků v jedné operaci").
 */
export type TurningSubtype =
  | "external_longitudinal"
  | "internal_longitudinal"
  | "facing"
  | "drilling"
  | "grooving"
  | "parting"
  | "threading"
  | "custom_path";

/** Režim obrábění (AP-MCE-001 Fáze C §2) - ovlivňuje výchozí přídavek na
 *  dokončení a `machiningModeCoefficient` (§10). */
export type MachiningMode = "roughing" | "semi_finishing" | "finishing";

/** Kdy se má u featuru provést měření (AP-MCE-001 Fáze C §3 "započítat
 *  měření pouze tam, kde je požadováno") - `"none"` je výchozí, žádný
 *  measurementTime se nepřičítá. */
export type MeasurementRequirement = "none" | "first_piece" | "every_piece" | "sampling";
