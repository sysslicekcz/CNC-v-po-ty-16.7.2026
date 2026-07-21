import type { GrindingSubtype, MachiningMode, MeasurementRequirement, SparkOutRequirement } from "./grinding-subtype";
import { GrindingFeatureGeometry } from "./grinding-feature-geometry";
import { GrindingPassStrategyInput } from "./grinding-pass-strategy-input";
import { WheelDressingStrategyInput } from "./wheel-dressing-strategy";

/** §2 "workpieceSpeedRpm"/"wheelSpeedMps"/"feedRateMmMin"/"tableSpeedMmMin" na
 *  úrovni featuru - explicitní PŘEPIS řešení `CuttingConditionResolver`,
 *  stejný princip jako Fáze C/D `...CuttingConditionOverride`. */
export interface GrindingCuttingConditionOverride {
  workpieceSpeedRpm?: number;
  wheelSpeedMps?: number;
  feedRateMmMin?: number;
  tableSpeedMmMin?: number;
  wheelDiameterMm?: number;
  wheelWidthMm?: number;
}

/**
 * Jeden brusný úsek operace (AP-MCE-001 Fáze E §3) - jedna operace nese
 * `GrindingCalculationInput.features: GrindingFeature[]`, v POŘADÍ `sequence`
 * (§3 "zachovat pořadí"). Technologická pole ze zadání §2 jsou VŠECHNA tady,
 * PER FEATURE - jedna operace může kombinovat vnější průměr + osazení + čelo
 * + zápich (§3 příklady), každý s jinou geometrií/kotoučem/podmínkami.
 */
export interface GrindingFeature {
  id: string;
  /** Pořadí v rámci operace (0-based) - NIKDY se nepřeuspořádává. */
  sequence: number;
  subtype: GrindingSubtype;
  machiningMode: MachiningMode;
  geometry: GrindingFeatureGeometry;
  /** Nepovinné - feature bez konkrétního kotouče je platný vstup (jen se pro
   *  něj nepočítá výměna kotouče ani jeho životnost). Referencuje `ToolProfile.
   *  id` (broušecí kotouč je modelovaný jako `ToolProfile`, stejná identitní
   *  konvence jako Fáze C/D nástroje - žádná nová entita `WheelProfile`). */
  wheelProfileId?: string;
  cuttingConditionOverride?: GrindingCuttingConditionOverride;
  passStrategy?: GrindingPassStrategyInput;
  dressingStrategy?: WheelDressingStrategyInput;
  measurementRequirement?: MeasurementRequirement;
  /** §2 "measurementFrequencyPieces"/"measurementTimeMin" - TECHNOLOGICKÁ
   *  pole (na rozdíl od Fáze C/D, kde měření bylo jen operační), protože
   *  různé brusné úseky mohou mít různou přísnost měření (např. dokončovací
   *  jiskření se měří po každém kuse, hrubovací průchod vůbec). */
  measurementFrequencyPieces?: number;
  measurementTimeMin?: number;
  correctionPassOnDeviation?: boolean;
  correctionPassTimeMin?: number;
  sparkOutRequirement?: SparkOutRequirement;
  notes?: string;

  /** §2 - explicitní PŘEPIS automatického výpočtu výměn kotouče z opotřebení
   *  PRO TENHLE kotouč (stejný princip jako Fáze C/D `plannedToolChanges`). */
  plannedWheelReplacements?: number;
  fixtureChangeCount?: number;
  /** §6 "obrácení dílu, pokud je zadáno" - `true`, pokud tenhle rovinný
   *  brusný úsek vyžaduje otočení dílu (druhá strana), počítá se jako
   *  přídavný pomocný čas (stejná role jako `fixtureChangeCount`, jiný
   *  fyzický děj). */
  partReversalRequired?: boolean;
}
