/**
 * Podporované technologické podtypy broušení (AP-MCE-001 Fáze E §2) - jeden
 * `GrindingFeature` má vždy přesně jeden `subtype`. Podtypy se dělí na dvě
 * technologické rodiny (viz `GrindingCalculationStrategy` dispatcher):
 *  - VÁLCOVÁ rodina - `external_cylindrical`/`internal_cylindrical`/
 *    `face_grinding`/`plunge_grinding`/`traverse_grinding`/
 *    `centerless_through_feed`/`centerless_in_feed` -> `CylindricalGrinding
 *    CalculationStrategy`.
 *  - ROVINNÁ rodina - `surface_reciprocating`/`surface_creep_feed` ->
 *    `SurfaceGrindingCalculationStrategy`.
 *  - `custom_path` patří do OBOU rodin podle toho, jakou geometrii feature
 *    skutečně nese (válcovou - `startDiameterMm`/`endDiameterMm` - nebo
 *    rovinnou - `surfaceLengthMm`/`surfaceWidthMm`).
 */
export type GrindingSubtype =
  | "external_cylindrical"
  | "internal_cylindrical"
  | "face_grinding"
  | "plunge_grinding"
  | "traverse_grinding"
  | "centerless_through_feed"
  | "centerless_in_feed"
  | "surface_reciprocating"
  | "surface_creep_feed"
  | "custom_path";

/** Režim obrábění (AP-MCE-001 Fáze E §2) - ovlivňuje `machiningModeCoefficient`/
 *  `finishGrindingCoefficient` (§13), NA ROZDÍL od Fáze C/D neurčuje SAMO O
 *  SOBĚ počet průchodů (§4 formule pro `roughingPasses`/`finishingPasses`
 *  platí SOUČASNĚ, ne jako vzájemně se vylučující větve - jeden brusný úsek
 *  typicky obsahuje hrubovací i dokončovací průchody dohromady). */
export type MachiningMode = "roughing" | "semi_finishing" | "finishing";

/** Kdy se má u featuru provést měření (AP-MCE-001 Fáze E §3/§11) - `"none"`
 *  je výchozí. */
export type MeasurementRequirement = "none" | "first_piece" | "every_piece" | "sampling";

/** Kdy se má u featuru provést jiskření/spark-out (AP-MCE-001 Fáze E §3) -
 *  odděleně od `passStrategy.sparkOutPasses` (to je POČET jiskřicích
 *  průchodů, tohle je POLITIKA, kdy se vůbec počítají - stejný vztah jako
 *  `MeasurementRequirement` vs. `measurementTimePerPieceMin`). */
export type SparkOutRequirement = "none" | "every_piece" | "first_piece_only" | "sampling";
