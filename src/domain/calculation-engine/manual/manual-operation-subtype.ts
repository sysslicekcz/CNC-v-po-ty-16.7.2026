/**
 * Podporované podtypy ručních operací (AP-MCE-001 Fáze F §2) - jeden
 * `ManualOperationFeature` má vždy přesně jeden `subtype`.
 */
export type ManualOperationSubtype =
  | "deburring"
  | "hand_grinding"
  | "polishing"
  | "cleaning"
  | "washing"
  | "marking"
  | "packing"
  | "unpacking"
  | "manual_drilling"
  | "manual_tapping"
  | "straightening"
  | "fitting"
  | "simple_assembly"
  | "disassembly"
  | "preparation"
  | "handling"
  | "custom_manual";

/** Na co se `baseTimeMin`/`repetitionCount` vztahuje (AP-MCE-001 Fáze F §3) -
 *  určuje, jak se čas featuru škáluje s dávkou (§4 "rozlišit jednorázový a
 *  kusový čas"). */
export type ManualQuantityBasis = "per_piece" | "per_batch" | "per_order" | "per_occurrence";

/** Odkud pochází `baseTimeMin` featuru (AP-MCE-001 Fáze F §3) - zapisuje se
 *  do `ManualOperationFeatureBreakdown.source`, ovlivňuje confidence (§14). */
export type ManualTimeBasis = "explicit" | "template" | "historical_average" | "rule_based" | "standard_time";

/** Sériovost výroby (AP-MCE-001 Fáze F §2 "productionSeriality") - ovlivňuje
 *  `serialityCoefficient` (§13, opakování stejné operace ve velké sérii je
 *  typicky rychlejší na kus než kusová/malosériová výroba). */
export type ProductionSeriality = "single_piece" | "small_batch" | "medium_batch" | "large_batch" | "mass_production";
