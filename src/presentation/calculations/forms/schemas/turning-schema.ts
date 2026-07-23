import { StrategyFormSchema } from "../form-field-types";

/** `TurningCalculationForm` schéma (AP-MCE-001 Fáze H §6) - pokrývá VŠECH
 *  osm podtypů soustružení + geometrii/řezné podmínky/pass strategii z
 *  `TurningFeature`/`TurningFeatureGeometry`/`TurningCuttingConditionOverride`/
 *  `TurningPassStrategyInput` (Fáze C), beze změny domény. */
export const TURNING_FORM_SCHEMA: StrategyFormSchema = {
  key: "turning",
  label: "Soustružení",
  category: "turning",
  subtypeOptions: [
    { value: "external_longitudinal", label: "Podélné soustružení (vnější)" },
    { value: "internal_longitudinal", label: "Podélné soustružení (vnitřní)" },
    { value: "facing", label: "Čelní soustružení" },
    { value: "drilling", label: "Vrtání" },
    { value: "grooving", label: "Zapichování" },
    { value: "parting", label: "Upichování" },
    { value: "threading", label: "Závitování" },
    { value: "custom_path", label: "Vlastní dráha" },
  ],
  machiningModeOptions: [
    { value: "roughing", label: "Hrubování" },
    { value: "semi_finishing", label: "Předdokončení" },
    { value: "finishing", label: "Dokončení" },
  ],
  measurementRequirementOptions: [
    { value: "none", label: "Žádné" },
    { value: "first_piece", label: "První kus" },
    { value: "every_piece", label: "Každý kus" },
    { value: "sampling", label: "Namátkově" },
  ],
  featureFields: [
    { key: "startDiameterMm", group: "geometry", label: "Počáteční průměr", type: "number", unit: "mm" },
    { key: "endDiameterMm", group: "geometry", label: "Koncový průměr", type: "number", unit: "mm" },
    { key: "machiningLengthMm", group: "geometry", label: "Délka obrábění", type: "number", unit: "mm" },
    { key: "radialAllowanceMm", group: "geometry", label: "Radiální přídavek", type: "number", unit: "mm" },
    { key: "axialAllowanceMm", group: "geometry", label: "Axiální přídavek", type: "number", unit: "mm" },
    { key: "approachLengthMm", group: "geometry", label: "Nájezd", type: "number", unit: "mm" },
    { key: "retractLengthMm", group: "geometry", label: "Výjezd", type: "number", unit: "mm" },
    { key: "threadPitchMm", group: "geometry", label: "Stoupání závitu", type: "number", unit: "mm", appliesToSubtypes: ["threading"] },
    { key: "peckDepthMm", group: "geometry", label: "Hloubka pecku", type: "number", unit: "mm", appliesToSubtypes: ["drilling"] },
    { key: "holeCount", group: "geometry", label: "Počet otvorů", type: "number", appliesToSubtypes: ["drilling"] },
    { key: "customPathLengthMm", group: "geometry", label: "Délka vlastní dráhy", type: "number", unit: "mm", appliesToSubtypes: ["custom_path"] },
    { key: "customPathRepeats", group: "geometry", label: "Opakování dráhy", type: "number", appliesToSubtypes: ["custom_path"] },

    { key: "cuttingSpeedMMin", group: "cuttingConditionOverride", label: "Řezná rychlost (přepis)", type: "number", unit: "m/min" },
    { key: "feedPerRevolutionMm", group: "cuttingConditionOverride", label: "Posuv na otáčku (přepis)", type: "number", unit: "mm/ot" },
    { key: "spindleSpeedRpm", group: "cuttingConditionOverride", label: "Otáčky (přepis)", type: "number", unit: "min⁻¹" },
    { key: "explicitDiameterOverrideMm", group: "cuttingConditionOverride", label: "Explicitní průměr pro otáčky", type: "number", unit: "mm" },

    { key: "passCount", group: "passStrategy", label: "Počet průchodů (explicitní)", type: "number" },
    { key: "roughingDepthOfCutMm", group: "passStrategy", label: "Hloubka řezu hrubování", type: "number", unit: "mm" },
    { key: "finishingAllowanceMm", group: "passStrategy", label: "Přídavek na dokončení", type: "number", unit: "mm" },
    { key: "finishingPasses", group: "passStrategy", label: "Počet dokončovacích průchodů", type: "number" },
    { key: "springPassCount", group: "passStrategy", label: "Jiskřicí průchody", type: "number" },

    { key: "toolProfileId", group: "feature", label: "Nástroj (id profilu)", type: "text" },
    { key: "dwellTimeSec", group: "feature", label: "Prodleva (dwell)", type: "number", unit: "s" },
    { key: "clampingCount", group: "feature", label: "Počet upnutí", type: "number" },
    { key: "fixtureChangeCount", group: "feature", label: "Počet přeupnutí", type: "number" },
    { key: "plannedToolChanges", group: "feature", label: "Plánované výměny nástroje (přepis)", type: "number" },
    { key: "coolantMode", group: "feature", label: "Chlazení", type: "text" },
    { key: "interruptedCut", group: "feature", label: "Přerušovaný řez", type: "checkbox" },
    { key: "internalMachining", group: "feature", label: "Vnitřní obrábění", type: "checkbox" },
  ],
  operationFields: [
    { key: "workstationId", group: "feature", label: "Pracoviště", type: "text" },
    { key: "batchSize", group: "feature", label: "Velikost dávky", type: "number" },
    { key: "setupTimeMin", group: "feature", label: "Seřízení", type: "number", unit: "min" },
    { key: "handlingTimePerPieceMin", group: "feature", label: "Manipulace na kus", type: "number", unit: "min" },
    { key: "measurementTimePerPieceMin", group: "feature", label: "Měření na kus", type: "number", unit: "min" },
    { key: "firstPieceInspectionTimeMin", group: "feature", label: "Kontrola prvního kusu", type: "number", unit: "min" },
    { key: "finalInspectionTimeMin", group: "feature", label: "Závěrečná kontrola", type: "number", unit: "min" },
    { key: "fixedAllowanceMin", group: "feature", label: "Fixní přirážka", type: "number", unit: "min" },
    { key: "percentageAllowance", group: "feature", label: "Procentní přirážka", type: "number", unit: "%" },
  ],
};
