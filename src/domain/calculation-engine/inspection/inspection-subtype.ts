/**
 * Podporované podtypy kontrolních činností (AP-MCE-001 Fáze F §6) - jeden
 * `InspectionFeature` má vždy přesně jeden `subtype`.
 */
export type InspectionSubtype =
  | "visual"
  | "dimensional_manual"
  | "dimensional_cmm"
  | "gauge"
  | "surface_roughness"
  | "hardness"
  | "runout"
  | "balancing"
  | "pressure_test"
  | "leak_test"
  | "functional_test"
  | "material_certificate_review"
  | "documentation_review"
  | "final_release"
  | "custom_inspection";

/** Úroveň/moment kontroly v rámci dávky (AP-MCE-001 Fáze F §6) - ovlivňuje,
 *  KOLIK kusů se skutečně kontroluje (§8 `InspectionSamplingStrategy`). */
export type InspectionLevel = "first_piece" | "in_process" | "sample" | "hundred_percent" | "final_batch" | "document_only";
