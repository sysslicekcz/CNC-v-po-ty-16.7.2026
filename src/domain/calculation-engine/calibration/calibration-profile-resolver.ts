import type { OperationCategory } from "../enums/operation-category";
import { CalculationIssue } from "../entities/types";
import { calibrationIssue } from "./calibration-issue-codes";
import { CalibrationProfile, CalibrationProfileScope } from "./calibration-profile";

export interface CalibrationProfileResolverInput {
  candidates: readonly CalibrationProfile[];
  tenantId: string;
  siteId?: string;
  operationCategory: OperationCategory;
  operationSubtype?: string;
  machineProfileId?: string;
  materialGroupId?: string;
  toolTypeId?: string;
  workstationId?: string;
  now: string;
}

export interface CalibrationProfileResolution {
  selectedProfile?: CalibrationProfile;
  selectedVersion?: number;
  matchedScope?: CalibrationProfileScope;
  /** Rozsahy, které se ZKUSILY, ale nenašly shodu, PŘED tím, než se vybral
   *  `matchedScope` (§19 "fallbackPath") - prázdné, pokud uspěla první
   *  (nejkonkrétnější) úroveň. */
  fallbackPath: CalibrationProfileScope[];
  confidence: number;
  warnings: CalculationIssue[];
}

const SCOPE_CONFIDENCE: Record<CalibrationProfileScope, number> = {
  machine_material_and_tool: 1,
  machine_and_material: 0.9,
  machine: 0.8,
  manual_operation: 0.75,
  inspection_method: 0.75,
  workstation: 0.7,
  site: 0.6,
  operation_subtype: 0.5,
  operation_category: 0.4,
  tenant: 0.3,
  global: 0.2,
};

/**
 * `CalibrationProfileResolver` (AP-MCE-001 Fáze G §19) - ČISTÁ funkce,
 * priorita PŘESNĚ podle zadání (1-9, "žádná kalibrace" = 10. úroveň jako
 * `selectedProfile: undefined`). Vidí jen kandidáty, které `CalculationContext
 * Resolver`/`ResolveCalibrationProfileUseCase` (Application vrstva) UŽ
 * načetl a PŘEDFILTROVAL na `isUsableInCalculation` (jen `"active"`) +
 * `isValidAt(now)` + `tenantId` (§19 "CalculationContextResolver musí použít
 * pouze active, approved, časově platný, tenantově správný profil") - tahle
 * funkce filtr aplikuje ZNOVU jako obranu do hloubky, ať nezávisí jen na
 * disciplíně volajícího.
 */
export function resolveCalibrationProfile(input: CalibrationProfileResolverInput): CalibrationProfileResolution {
  const usable = input.candidates.filter((p) => p.tenantId === input.tenantId && p.isUsableInCalculation && p.isValidAt(input.now));
  const fallbackPath: CalibrationProfileScope[] = [];

  const tryScope = (scope: CalibrationProfileScope, predicate: (p: CalibrationProfile) => boolean): CalibrationProfile | undefined => {
    const match = usable.find((p) => p.scope === scope && predicate(p));
    if (!match) fallbackPath.push(scope);
    return match;
  };

  const bySubtype = (p: CalibrationProfile) => p.operationSubtype === undefined || p.operationSubtype === input.operationSubtype;

  let selected: CalibrationProfile | undefined;
  if (input.machineProfileId && input.materialGroupId && input.toolTypeId) {
    selected = tryScope("machine_material_and_tool", (p) => p.machineProfileId === input.machineProfileId && p.materialGroupId === input.materialGroupId && p.toolTypeId === input.toolTypeId && bySubtype(p));
  }
  if (!selected && input.machineProfileId && input.materialGroupId) {
    selected = tryScope("machine_and_material", (p) => p.machineProfileId === input.machineProfileId && p.materialGroupId === input.materialGroupId && bySubtype(p));
  }
  if (!selected && input.machineProfileId) {
    selected = tryScope("machine", (p) => p.machineProfileId === input.machineProfileId && bySubtype(p));
  }
  if (!selected && input.operationCategory === "manual") {
    selected = tryScope("manual_operation", (p) => bySubtype(p));
  }
  if (!selected && input.operationCategory === "inspection") {
    selected = tryScope("inspection_method", (p) => bySubtype(p));
  }
  if (!selected && input.workstationId) {
    selected = tryScope("workstation", (p) => p.workstationId === input.workstationId && bySubtype(p));
  }
  if (!selected && input.siteId) {
    selected = tryScope("site", (p) => p.siteId === input.siteId && bySubtype(p));
  }
  if (!selected && input.operationSubtype) {
    selected = tryScope("operation_subtype", (p) => p.operationSubtype === input.operationSubtype);
  }
  if (!selected) {
    selected = tryScope("operation_category", (p) => p.operationCategory === input.operationCategory);
  }
  if (!selected) {
    selected = tryScope("tenant", () => true);
  }
  if (!selected) {
    selected = tryScope("global", () => true);
  }

  if (!selected) {
    return { fallbackPath, confidence: 0, warnings: [calibrationIssue("CALIBRATION_PROFILE_NOT_ACTIVE", "Pro danou kombinaci nebyl nalezen žádný aktivní kalibrační profil - výpočet poběží bez kalibrace.")] };
  }

  return {
    selectedProfile: selected,
    selectedVersion: selected.recordVersion,
    matchedScope: selected.scope,
    fallbackPath,
    confidence: SCOPE_CONFIDENCE[selected.scope],
    warnings: [],
  };
}
