import type { ComplexityLevel } from "./manual-operation-feature";
import { ManualTimeStandard, ManualTimeStandardSource } from "./manual-time-standard";

export interface ResolveManualTimeStandardInput {
  candidates: readonly ManualTimeStandard[];
  complexityLevel?: ComplexityLevel;
  now: string;
}

export interface ResolvedManualTimeStandard {
  standard?: ManualTimeStandard;
  source: ManualTimeStandardSource | "none";
}

/** §5 "Podporuj zdroje" priorita mezi TENANT standardy (systémový default je
 *  vždy až POSLEDNÍ, nezávisle na tomhle pořadí) - konkrétnější/přesnější
 *  zdroj vyhrává, stejná filozofie jako Fáze B `resolveCuttingConditions()`
 *  úrovně. */
const TENANT_SOURCE_PRIORITY: readonly ManualTimeStandardSource[] = ["tenant_standard", "historical_average", "imported", "manually_defined", "external_method"];

const COMPLEXITY_ORDER: Record<ComplexityLevel, number> = { low: 0, medium: 1, high: 2 };

function matchesComplexity(standard: ManualTimeStandard, complexityLevel: ComplexityLevel | undefined): boolean {
  if (!standard.complexityRange || complexityLevel === undefined) return true;
  const level = COMPLEXITY_ORDER[complexityLevel];
  return level >= COMPLEXITY_ORDER[standard.complexityRange.min] && level <= COMPLEXITY_ORDER[standard.complexityRange.max];
}

/**
 * `resolveManualTimeStandard` (AP-MCE-001 Fáze F §5) - ČISTÁ funkce, žádné
 * I/O. `candidates` už načetl Application-layer resolver (repository smí
 * volat jen use case/resolver service, ne strategie, stejný princip jako
 * Fáze B `CuttingConditionResolverService`). Vrací NEJLEPŠÍ platný standard
 * podle priority: tenant standardy (§ `TENANT_SOURCE_PRIORITY`) -> systémový
 * default (`tenantId === undefined`) -> `undefined` (volající pak použije
 * svůj vlastní tvrdý fallback, stejně jako Fáze C `SYSTEM_DEFAULT_*`
 * konstanty).
 */
export function resolveManualTimeStandard(input: ResolveManualTimeStandardInput): ResolvedManualTimeStandard {
  const valid = input.candidates.filter((c) => c.isValidAt(input.now) && matchesComplexity(c, input.complexityLevel));

  for (const source of TENANT_SOURCE_PRIORITY) {
    const match = valid.find((c) => c.source === source && c.tenantId !== undefined);
    if (match) return { standard: match, source };
  }

  const systemDefault = valid.find((c) => c.source === "system_default");
  if (systemDefault) return { standard: systemDefault, source: "system_default" };

  return { standard: undefined, source: "none" };
}
