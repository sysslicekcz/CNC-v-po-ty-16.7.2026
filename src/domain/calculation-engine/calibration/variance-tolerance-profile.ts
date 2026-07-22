import { ValidationError } from "@/domain/errors/validation-error";
import type { OperationCategory } from "../enums/operation-category";

/** AP-MCE-001 Fáze G §8 - devět porovnávaných metrik. */
export type VarianceMetric = "setup" | "machine_time" | "operator_time" | "handling" | "inspection" | "tool_change" | "unit_time" | "batch_time" | "total_time";

export interface VarianceToleranceProfileProps {
  id: string;
  tenantId: string;
  siteId?: string;
  operationCategory?: OperationCategory;
  operationSubtype?: string;
  metric: VarianceMetric;
  negligiblePercent: number;
  lowPercent: number;
  mediumPercent: number;
  highPercent: number;
  criticalPercent: number;
  absoluteMinimumToleranceMin: number;
  recordVersion: number;
  validFrom: string;
  validTo?: string;
}

/**
 * `VarianceToleranceProfile` (AP-MCE-001 Fáze G §9) - VERZOVANÉ nastavení
 * tolerancí per metrika (§8 seznam devíti), tenant-scoped. Prahy jsou
 * KUMULATIVNÍ (negligible < low < medium < high < critical) - `create()` to
 * vynucuje, ať `classifySeverity` (viz `calculation-variance.ts`) nemusí
 * řešit nekonzistentní konfiguraci za běhu.
 */
export class VarianceToleranceProfile {
  private readonly props: Readonly<VarianceToleranceProfileProps>;

  private constructor(props: VarianceToleranceProfileProps) {
    this.props = Object.freeze({ ...props });
  }

  static create(props: VarianceToleranceProfileProps): VarianceToleranceProfile {
    if (!props.id.trim()) throw new ValidationError("VarianceToleranceProfile: 'id' nesmí být prázdné.");
    if (!props.tenantId.trim()) throw new ValidationError("VarianceToleranceProfile: 'tenantId' nesmí být prázdné.");
    const thresholds = [props.negligiblePercent, props.lowPercent, props.mediumPercent, props.highPercent, props.criticalPercent];
    for (const t of thresholds) {
      if (!Number.isFinite(t) || t < 0) throw new ValidationError("VarianceToleranceProfile: prahy tolerance nesmí být záporné.");
    }
    for (let i = 1; i < thresholds.length; i++) {
      if (thresholds[i] < thresholds[i - 1]) {
        throw new ValidationError("VarianceToleranceProfile: prahy musí být rostoucí (negligible <= low <= medium <= high <= critical).");
      }
    }
    if (!Number.isInteger(props.recordVersion) || props.recordVersion < 1) {
      throw new ValidationError("VarianceToleranceProfile: 'recordVersion' musí být kladné celé číslo.");
    }
    return new VarianceToleranceProfile(props);
  }

  get id(): string {
    return this.props.id;
  }
  get tenantId(): string {
    return this.props.tenantId;
  }
  get siteId(): string | undefined {
    return this.props.siteId;
  }
  get operationCategory(): OperationCategory | undefined {
    return this.props.operationCategory;
  }
  get operationSubtype(): string | undefined {
    return this.props.operationSubtype;
  }
  get metric(): VarianceMetric {
    return this.props.metric;
  }
  get negligiblePercent(): number {
    return this.props.negligiblePercent;
  }
  get lowPercent(): number {
    return this.props.lowPercent;
  }
  get mediumPercent(): number {
    return this.props.mediumPercent;
  }
  get highPercent(): number {
    return this.props.highPercent;
  }
  get criticalPercent(): number {
    return this.props.criticalPercent;
  }
  get absoluteMinimumToleranceMin(): number {
    return this.props.absoluteMinimumToleranceMin;
  }
  get recordVersion(): number {
    return this.props.recordVersion;
  }
  get validFrom(): string {
    return this.props.validFrom;
  }
  get validTo(): string | undefined {
    return this.props.validTo;
  }

  isValidAt(atIso: string): boolean {
    if (atIso < this.props.validFrom) return false;
    if (this.props.validTo && atIso > this.props.validTo) return false;
    return true;
  }

  toPlainObject(): Record<string, unknown> {
    return { ...this.props };
  }
}

/** Systémový default (§9 priorita 4. "system default") - použije se, pokud
 *  tenant žádný vlastní profil pro danou metriku nemá. Zdokumentované MVP
 *  hodnoty (10/20/35/60 %), stejná disciplína jako `SYSTEM_DEFAULT_*`
 *  konstanty v předchozích fázích. */
export function systemDefaultToleranceProfile(metric: VarianceMetric): VarianceToleranceProfile {
  return VarianceToleranceProfile.create({
    id: `system-default:${metric}`,
    tenantId: "system",
    metric,
    negligiblePercent: 5,
    lowPercent: 10,
    mediumPercent: 20,
    highPercent: 35,
    criticalPercent: 60,
    absoluteMinimumToleranceMin: 1,
    recordVersion: 1,
    validFrom: "1970-01-01T00:00:00.000Z",
  });
}

export interface ResolveVarianceToleranceInput {
  candidates: readonly VarianceToleranceProfile[];
  tenantId: string;
  siteId?: string;
  operationCategory: OperationCategory;
  operationSubtype?: string;
  metric: VarianceMetric;
  now: string;
}

/**
 * `resolveVarianceToleranceProfile` (AP-MCE-001 Fáze G §9) - ČISTÁ funkce,
 * priorita PŘESNĚ podle zadání: (1) tenant+site+subtype, (2) tenant+category,
 * (3) tenant default (bez subtype/category), (4) system default.
 */
export function resolveVarianceToleranceProfile(input: ResolveVarianceToleranceInput): VarianceToleranceProfile {
  const valid = input.candidates.filter((p) => p.metric === input.metric && p.tenantId === input.tenantId && p.isValidAt(input.now));

  const siteAndSubtype = valid.find((p) => p.siteId === input.siteId && p.siteId !== undefined && p.operationSubtype === input.operationSubtype && p.operationSubtype !== undefined);
  if (siteAndSubtype) return siteAndSubtype;

  const category = valid.find((p) => p.operationCategory === input.operationCategory && p.siteId === undefined && p.operationSubtype === undefined);
  if (category) return category;

  const tenantDefault = valid.find((p) => p.operationCategory === undefined && p.operationSubtype === undefined && p.siteId === undefined);
  if (tenantDefault) return tenantDefault;

  return systemDefaultToleranceProfile(input.metric);
}
