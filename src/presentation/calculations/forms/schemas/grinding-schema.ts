import { StrategyFormSchema } from "../form-field-types";

const MEASUREMENT_OPTIONS = [
  { value: "none", label: "Žádné" },
  { value: "first_piece", label: "První kus" },
  { value: "every_piece", label: "Každý kus" },
  { value: "sampling", label: "Namátkově" },
];

const MACHINING_MODE_OPTIONS = [
  { value: "roughing", label: "Hrubování" },
  { value: "semi_finishing", label: "Předdokončení" },
  { value: "finishing", label: "Dokončení" },
];

const COMMON_CUTTING_FIELDS = [
  { key: "workpieceSpeedRpm", group: "cuttingConditionOverride" as const, label: "Otáčky obrobku (přepis)", type: "number" as const, unit: "min⁻¹" },
  { key: "wheelSpeedMps", group: "cuttingConditionOverride" as const, label: "Rychlost kotouče (přepis)", type: "number" as const, unit: "m/s" },
  { key: "feedRateMmMin", group: "cuttingConditionOverride" as const, label: "Posuvová rychlost (přepis)", type: "number" as const, unit: "mm/min" },
  { key: "tableSpeedMmMin", group: "cuttingConditionOverride" as const, label: "Rychlost stolu (přepis)", type: "number" as const, unit: "mm/min" },
  { key: "wheelDiameterMm", group: "cuttingConditionOverride" as const, label: "Průměr kotouče (přepis)", type: "number" as const, unit: "mm" },
  { key: "wheelWidthMm", group: "cuttingConditionOverride" as const, label: "Šířka kotouče (přepis)", type: "number" as const, unit: "mm" },
];

const COMMON_FEATURE_FIELDS = [
  { key: "wheelProfileId", group: "feature" as const, label: "Brusný kotouč (id profilu)", type: "text" as const },
  { key: "plannedWheelReplacements", group: "feature" as const, label: "Plánované výměny kotouče (přepis)", type: "number" as const },
  { key: "fixtureChangeCount", group: "feature" as const, label: "Počet přeupnutí", type: "number" as const },
  { key: "measurementFrequencyPieces", group: "feature" as const, label: "Frekvence měření (ks)", type: "number" as const },
  { key: "measurementTimeMin", group: "feature" as const, label: "Čas měření", type: "number" as const, unit: "min" },
  { key: "correctionPassOnDeviation", group: "feature" as const, label: "Korekční přebroušení při odchylce", type: "checkbox" as const },
  { key: "correctionPassTimeMin", group: "feature" as const, label: "Čas korekčního přebroušení", type: "number" as const, unit: "min" },

  { key: "dressingIntervalPieces", group: "dressingStrategy" as const, label: "Interval orovnání (ks)", type: "number" as const },
  { key: "dressingIntervalMinutes", group: "dressingStrategy" as const, label: "Interval orovnání (min)", type: "number" as const },
  { key: "dressingTimeMin", group: "dressingStrategy" as const, label: "Čas orovnání", type: "number" as const, unit: "min" },
  { key: "initialDressingRequired", group: "dressingStrategy" as const, label: "Orovnání před 1. kusem", type: "checkbox" as const },
  { key: "manualPlannedDressings", group: "dressingStrategy" as const, label: "Počet orovnání (přepis)", type: "number" as const },

  { key: "passCount", group: "passStrategy" as const, label: "Počet průchodů (explicitní)", type: "number" as const },
  { key: "sparkOutPasses", group: "passStrategy" as const, label: "Jiskřicí průchody", type: "number" as const },
];

const COMMON_OPERATION_FIELDS = [
  { key: "workstationId", group: "feature" as const, label: "Pracoviště", type: "text" as const },
  { key: "batchSize", group: "feature" as const, label: "Velikost dávky", type: "number" as const },
  { key: "setupTimeMin", group: "feature" as const, label: "Seřízení", type: "number" as const, unit: "min" },
  { key: "handlingTimePerPieceMin", group: "feature" as const, label: "Manipulace na kus", type: "number" as const, unit: "min" },
  { key: "measurementTimePerPieceMin", group: "feature" as const, label: "Měření na kus", type: "number" as const, unit: "min" },
  { key: "firstPieceInspectionTimeMin", group: "feature" as const, label: "Kontrola prvního kusu", type: "number" as const, unit: "min" },
  { key: "finalInspectionTimeMin", group: "feature" as const, label: "Závěrečná kontrola", type: "number" as const, unit: "min" },
  { key: "fixedAllowanceMin", group: "feature" as const, label: "Fixní přirážka", type: "number" as const, unit: "min" },
  { key: "percentageAllowance", group: "feature" as const, label: "Procentní přirážka", type: "number" as const, unit: "%" },
  { key: "clampingCount", group: "feature" as const, label: "Počet upnutí operace", type: "number" as const },
  { key: "wheelProfileId", group: "feature" as const, label: "Výchozí kotouč (id profilu)", type: "text" as const },
  { key: "coolantMode", group: "feature" as const, label: "Chlazení", type: "text" as const },
];

/** `CylindricalGrindingCalculationForm` schéma (AP-MCE-001 Fáze H §8). */
export const GRINDING_CYLINDRICAL_FORM_SCHEMA: StrategyFormSchema = {
  key: "grinding_cylindrical",
  label: "Broušení - válcové",
  category: "grinding",
  subtypeOptions: [
    { value: "external_cylindrical", label: "Vnější průměr" },
    { value: "internal_cylindrical", label: "Vnitřní průměr" },
    { value: "face_grinding", label: "Čelo" },
    { value: "plunge_grinding", label: "Zápich (plunge)" },
    { value: "traverse_grinding", label: "Podélné (traverse)" },
    { value: "centerless_through_feed", label: "Bezhroté - průběžný posuv" },
    { value: "centerless_in_feed", label: "Bezhroté - zápichové" },
    { value: "custom_path", label: "Vlastní dráha" },
  ],
  machiningModeOptions: MACHINING_MODE_OPTIONS,
  measurementRequirementOptions: MEASUREMENT_OPTIONS,
  featureFields: [
    { key: "startDiameterMm", group: "geometry", label: "Počáteční průměr", type: "number", unit: "mm" },
    { key: "endDiameterMm", group: "geometry", label: "Koncový průměr", type: "number", unit: "mm" },
    { key: "grindingLengthMm", group: "geometry", label: "Délka broušení", type: "number", unit: "mm" },
    { key: "stockAllowanceMm", group: "geometry", label: "Celkový přídavek", type: "number", unit: "mm" },
    { key: "radialAllowanceMm", group: "geometry", label: "Radiální přídavek", type: "number", unit: "mm" },
    { key: "axialAllowanceMm", group: "geometry", label: "Axiální přídavek", type: "number", unit: "mm", appliesToSubtypes: ["face_grinding"] },
    { key: "approachLengthMm", group: "geometry", label: "Nájezd", type: "number", unit: "mm" },
    { key: "retractLengthMm", group: "geometry", label: "Výjezd", type: "number", unit: "mm" },
    { key: "dwellTimeSec", group: "geometry", label: "Prodleva (dwell)", type: "number", unit: "s" },
    ...COMMON_CUTTING_FIELDS,
    { key: "roughingInfeedPerPassMm", group: "passStrategy", label: "Záběr hrubovacího průchodu", type: "number", unit: "mm" },
    { key: "finishingInfeedPerPassMm", group: "passStrategy", label: "Záběr dokončovacího průchodu", type: "number", unit: "mm" },
    { key: "finishingAllowanceMm", group: "passStrategy", label: "Přídavek na dokončení", type: "number", unit: "mm" },
    ...COMMON_FEATURE_FIELDS,
  ],
  operationFields: COMMON_OPERATION_FIELDS,
};

/** `SurfaceGrindingCalculationForm` schéma (AP-MCE-001 Fáze H §8). */
export const GRINDING_SURFACE_FORM_SCHEMA: StrategyFormSchema = {
  key: "grinding_surface",
  label: "Broušení - rovinné",
  category: "grinding",
  subtypeOptions: [
    { value: "surface_reciprocating", label: "Rovinné (kyvadlové)" },
    { value: "surface_creep_feed", label: "Rovinné (creep-feed)" },
    { value: "custom_path", label: "Vlastní dráha" },
  ],
  machiningModeOptions: MACHINING_MODE_OPTIONS,
  measurementRequirementOptions: MEASUREMENT_OPTIONS,
  featureFields: [
    { key: "surfaceLengthMm", group: "geometry", label: "Délka plochy", type: "number", unit: "mm" },
    { key: "surfaceWidthMm", group: "geometry", label: "Šířka plochy", type: "number", unit: "mm" },
    { key: "stockAllowanceMm", group: "geometry", label: "Celkový přídavek", type: "number", unit: "mm" },
    { key: "approachLengthMm", group: "geometry", label: "Nájezd", type: "number", unit: "mm" },
    { key: "retractLengthMm", group: "geometry", label: "Výjezd", type: "number", unit: "mm" },
    { key: "dwellTimeSec", group: "geometry", label: "Prodleva (dwell)", type: "number", unit: "s" },
    ...COMMON_CUTTING_FIELDS,
    { key: "infeedPerPassMm", group: "passStrategy", label: "Hloubkový záběr", type: "number", unit: "mm" },
    { key: "crossFeedMm", group: "passStrategy", label: "Příčný posuv", type: "number", unit: "mm" },
    { key: "strokesPerPass", group: "passStrategy", label: "Zdvihů na pozici", type: "number" },
    ...COMMON_FEATURE_FIELDS,
    { key: "partReversalRequired", group: "feature", label: "Vyžaduje obrácení dílu", type: "checkbox" },
  ],
  operationFields: COMMON_OPERATION_FIELDS,
};
