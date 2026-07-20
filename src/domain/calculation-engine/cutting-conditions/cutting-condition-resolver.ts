import type { OperationCategory } from "../enums/operation-category";
import { CuttingSpeed } from "../value-objects/cutting-speed";
import { FeedRate, FeedRateUnit } from "../value-objects/feed-rate";
import { CalculationIssue } from "../entities/types";
import { CuttingCondition, CuttingConditionSource } from "./cutting-condition";
import { MaterialProfile } from "../profiles/material-profile";
import { ToolProfile } from "../profiles/tool-profile";

export interface ExplicitCuttingConditionValues {
  cuttingSpeed?: CuttingSpeed;
  feed?: FeedRate;
}

export interface ResolveCuttingConditionsRequest {
  materialProfileId: string;
  machineProfileId?: string;
  toolProfileId?: string;
  operationCategory: OperationCategory;
  operationSubtype?: string;
  feedUnit: FeedRateUnit;
  /** Úroveň 1 - hodnota explicitně zadaná v `CalculationRequest`. */
  explicitValues?: ExplicitCuttingConditionValues;
}

export interface ResolveCuttingConditionsCandidates {
  /** Úrovně 2/3 - už NAČTENÉ `CuttingCondition` (z `ToolMachineCondition` přes
   *  `CuttingConditionFactory`) relevantní pro danou kombinaci nástroj/stroj/
   *  materiál/kategorie, BEZ filtrování/řazení (resolver si je sám roztřídí). */
  candidates: readonly CuttingCondition[];
  materialProfile?: MaterialProfile;
  toolProfile?: ToolProfile;
  /** Úroveň 6 - systémová výchozí hodnota (tenant-wide fallback), pokud
   *  existuje. */
  systemDefault?: CuttingCondition;
}

export interface ResolvedValue<T> {
  value: T;
  source: CuttingConditionSource;
  confidence: number;
  /** Id záznamu, ze kterého hodnota pochází (`CuttingCondition.id`), pokud
   *  z něj hodnota pochází - `undefined` pro "explicit"/"material_recommendation"
   *  (ty nemají vlastní `CuttingCondition` id). */
  sourceRecordId?: string;
}

export interface CuttingConditionResolution {
  cuttingSpeed?: ResolvedValue<CuttingSpeed>;
  feed?: ResolvedValue<FeedRate>;
  issues: CalculationIssue[];
}

function bySpecificity(a: CuttingCondition, b: CuttingCondition): number {
  const specificity = (c: CuttingCondition) => (c.toolProfileId ? 2 : 0) + (c.machineProfileId ? 1 : 0);
  return specificity(b) - specificity(a) || b.priority - a.priority;
}

/**
 * `resolveCuttingConditions(input)` (AP-MCE-001 Fáze B §5) - ČISTÁ funkce,
 * žádné I/O (stejná disciplína jako existující Krok 5
 * `resolveCuttingConditions()` nad `ToolMachineCondition` - tahle funkce ji
 * NEnahrazuje, jen rozšiřuje o dalších pět úrovní priority, které Krok 5
 * neřešil). Priorita zdrojů přesně podle zadání:
 *
 *   1. explicitní hodnota z CalculationRequest
 *   2. schválená zákaznická CuttingCondition (source "tenant_approved")
 *   3. konkrétní kombinace nástroj + stroj + materiál
 *   4. doporučení nástroje pro materiál (ToolProfile.defaultCuttingParameters)
 *   5. doporučení materiálu pro operaci (MaterialProfile.recommendedCuttingSpeeds/Feeds)
 *   6. systémová výchozí hodnota
 *   7. chyba/warning podle chybějící hodnoty (žádná úroveň nic nenašla)
 *
 * Vrací PRO KAŽDOU hodnotu i to, ODKUD pochází a s jakou důvěryhodností -
 * nikdy tiše nevybere jen číslo bez zdroje (AP-MCE-001 Fáze A §05 princip
 * "žádný výsledek bez vysvětlení" platí i tady).
 */
export function resolveCuttingConditions(
  request: ResolveCuttingConditionsRequest,
  candidates: ResolveCuttingConditionsCandidates
): CuttingConditionResolution {
  const issues: CalculationIssue[] = [];
  const matching = candidates.candidates
    .filter((c) =>
      c.matches({
        toolProfileId: request.toolProfileId,
        machineProfileId: request.machineProfileId,
        materialProfileId: request.materialProfileId,
        operationCategory: request.operationCategory,
      })
    )
    .sort(bySpecificity);

  const tenantApproved = matching.find((c) => c.source === "tenant_approved");
  const toolMachineMaterial = matching.find((c) => c.toolProfileId && c.machineProfileId);

  const cuttingSpeed = resolveCuttingSpeed(request, candidates, tenantApproved, toolMachineMaterial);
  if (!cuttingSpeed) {
    issues.push({ code: "MISSING_CUTTING_SPEED", severity: "warning", message: "Řeznou rychlost se nepodařilo dohledat v žádném zdroji." });
  }

  const feed = resolveFeed(request, candidates, tenantApproved, toolMachineMaterial);
  if (!feed) {
    issues.push({ code: "MISSING_FEED", severity: "warning", message: "Posuv se nepodařilo dohledat v žádném zdroji." });
  }

  return { cuttingSpeed, feed, issues };
}

function resolveCuttingSpeed(
  request: ResolveCuttingConditionsRequest,
  candidates: ResolveCuttingConditionsCandidates,
  tenantApproved: CuttingCondition | undefined,
  toolMachineMaterial: CuttingCondition | undefined
): ResolvedValue<CuttingSpeed> | undefined {
  // 1. explicitní hodnota
  if (request.explicitValues?.cuttingSpeed) {
    return { value: request.explicitValues.cuttingSpeed, source: "explicit", confidence: 1 };
  }
  // 2. schválená zákaznická podmínka
  if (tenantApproved?.cuttingSpeed) {
    return { value: tenantApproved.cuttingSpeed, source: "tenant_approved", confidence: tenantApproved.confidence, sourceRecordId: tenantApproved.id };
  }
  // 3. konkrétní kombinace nástroj + stroj + materiál
  if (toolMachineMaterial?.cuttingSpeed) {
    return {
      value: toolMachineMaterial.cuttingSpeed,
      source: "tool_machine_material",
      confidence: toolMachineMaterial.confidence,
      sourceRecordId: toolMachineMaterial.id,
    };
  }
  // 4. doporučení nástroje pro materiál
  const toolRecommendation = candidates.toolProfile
    ?.cuttingParametersFor({ operationCategory: request.operationCategory, operationSubtype: request.operationSubtype })
    ?.parameters.vc;
  if (toolRecommendation !== undefined) {
    return { value: CuttingSpeed.ofMetersPerMinute(toolRecommendation), source: "tool_recommendation", confidence: 0.75 };
  }
  // 5. doporučení materiálu pro operaci
  const materialRecommendation = candidates.materialProfile?.bestCuttingSpeedFor({
    operationCategory: request.operationCategory,
    machiningSubtype: request.operationSubtype,
  });
  if (materialRecommendation) {
    return {
      value: CuttingSpeed.ofMetersPerMinute(materialRecommendation.recommendedValue),
      source: "material_recommendation",
      confidence: materialRecommendation.confidence,
    };
  }
  // 6. systémová výchozí hodnota
  if (candidates.systemDefault?.cuttingSpeed) {
    return {
      value: candidates.systemDefault.cuttingSpeed,
      source: "system_default",
      confidence: candidates.systemDefault.confidence,
      sourceRecordId: candidates.systemDefault.id,
    };
  }
  // 7. nic nenalezeno - řeší volající přes `issues`
  return undefined;
}

function resolveFeed(
  request: ResolveCuttingConditionsRequest,
  candidates: ResolveCuttingConditionsCandidates,
  tenantApproved: CuttingCondition | undefined,
  toolMachineMaterial: CuttingCondition | undefined
): ResolvedValue<FeedRate> | undefined {
  const feedOf = (c: CuttingCondition): FeedRate | undefined =>
    request.feedUnit === "mm_per_rev" ? c.feedPerRevolution : request.feedUnit === "mm_per_tooth" ? c.feedPerTooth : c.feedRate;

  if (request.explicitValues?.feed) {
    return { value: request.explicitValues.feed, source: "explicit", confidence: 1 };
  }
  const fromTenantApproved = tenantApproved && feedOf(tenantApproved);
  if (fromTenantApproved) {
    return { value: fromTenantApproved, source: "tenant_approved", confidence: tenantApproved!.confidence, sourceRecordId: tenantApproved!.id };
  }
  const fromToolMachineMaterial = toolMachineMaterial && feedOf(toolMachineMaterial);
  if (fromToolMachineMaterial) {
    return {
      value: fromToolMachineMaterial,
      source: "tool_machine_material",
      confidence: toolMachineMaterial!.confidence,
      sourceRecordId: toolMachineMaterial!.id,
    };
  }
  const toolRecommendation = candidates.toolProfile
    ?.cuttingParametersFor({ operationCategory: request.operationCategory, operationSubtype: request.operationSubtype })
    ?.parameters.feed;
  if (toolRecommendation !== undefined) {
    return { value: FeedRate.of(toolRecommendation, request.feedUnit), source: "tool_recommendation", confidence: 0.75 };
  }
  const materialRecommendation = candidates.materialProfile?.bestFeedFor({
    operationCategory: request.operationCategory,
    machiningSubtype: request.operationSubtype,
  });
  if (materialRecommendation) {
    return {
      value: FeedRate.of(materialRecommendation.recommendedValue, request.feedUnit),
      source: "material_recommendation",
      confidence: materialRecommendation.confidence,
    };
  }
  const systemDefault = candidates.systemDefault && feedOf(candidates.systemDefault);
  if (systemDefault) {
    return {
      value: systemDefault,
      source: "system_default",
      confidence: candidates.systemDefault!.confidence,
      sourceRecordId: candidates.systemDefault!.id,
    };
  }
  return undefined;
}
