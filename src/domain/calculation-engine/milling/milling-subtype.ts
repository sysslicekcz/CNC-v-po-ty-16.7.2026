/**
 * Podporované technologické podtypy frézování (AP-MCE-001 Fáze D §2) - jeden
 * `MillingFeature` má vždy přesně jeden `subtype`, operace (víc `MillingFeature`
 * za sebou) může kombinovat libovolně (§3: "více technologických úseků v
 * jedné operaci").
 */
export type MillingSubtype =
  | "face_milling"
  | "pocket_milling"
  | "contour_milling"
  | "slot_milling"
  | "drilling"
  | "countersinking"
  | "reaming"
  | "threading"
  | "two_d"
  | "two_and_half_d"
  | "three_d"
  | "custom_path";

/** Režim obrábění (AP-MCE-001 Fáze D §2) - ovlivňuje výchozí přídavek na
 *  dokončení a `machiningModeCoefficient` (§11). Stejný tvar jako Fáze C
 *  `TurningSubtype.MachiningMode` - VLASTNÍ typ modulu (ne re-export z
 *  `turning/`), aby frézovací modul zůstal nezávislý na soustružnickém
 *  (§21 architektonický test "TurningCalculationStrategy nebyla kvůli
 *  frézování měněna" - žádný nový import opačným směrem). */
export type MachiningMode = "roughing" | "semi_finishing" | "finishing";

/** Kdy se má u featuru provést měření (AP-MCE-001 Fáze D §3 "započítat
 *  měření jen tam, kde je vyžadováno") - `"none"` je výchozí. */
export type MeasurementRequirement = "none" | "first_piece" | "every_piece" | "sampling";
