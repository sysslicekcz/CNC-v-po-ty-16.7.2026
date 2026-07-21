import { TenantContext } from "@/domain/services/tenant-context";
import { ManualTimeStandardRepository } from "@/domain/calculation-engine/repositories/manual-time-standard-repository";
import type { ManualTimeStandardSource } from "@/domain/calculation-engine/manual/manual-time-standard";
import { CalculationIssue } from "@/domain/calculation-engine/entities/types";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";

export interface CompareManualStandardsInput {
  manualTimeStandardIds: string[];
}

export interface ManualStandardComparisonRow {
  standardId: string;
  standardName: string;
  standardVersion: string;
  source: ManualTimeStandardSource;
  baseTimeMin: number;
  /** Rozdíl oproti NEJRYCHLEJŠÍMU porovnávanému standardu (§17 "ukáže rozdíl
   *  času") - 0 pro nejrychlejší řádek. */
  timeDeltaMin: number;
  /** MVP proxy důvěryhodnosti bez skutečného výpočtu (§17 "confidence") -
   *  `system_default` je nejméně jistý zdroj, `tenant_standard` nejjistější,
   *  stejné pořadí jako `TENANT_SOURCE_PRIORITY` v `manual-time-standard-
   *  resolver.ts`. */
  confidenceHint: number;
  warnings: CalculationIssue[];
}

export interface ManualStandardComparisonResult {
  rows: ManualStandardComparisonRow[];
}

const SOURCE_CONFIDENCE_HINT: Record<ManualTimeStandardSource, number> = {
  tenant_standard: 1,
  manually_defined: 0.9,
  imported: 0.85,
  historical_average: 0.8,
  external_method: 0.75,
  system_default: 0.6,
};

/**
 * `CompareManualStandardsUseCase` (AP-MCE-001 Fáze F §17) - porovná VÍC
 * `ManualTimeStandard` vedle sebe (čas, zdroj, confidence, warningy), pro
 * rozhodnutí "který standard použít" PŘED spuštěním samotného výpočtu -
 * stejná role jako Fáze B `CompareToolProfilesUseCase`/`CompareMachine
 * ProfilesUseCase`, jen nad `ManualTimeStandard`.
 */
export class CompareManualStandardsUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly repository: ManualTimeStandardRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(input: CompareManualStandardsInput): Promise<ManualStandardComparisonResult> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationRead, "read");

    const rows: ManualStandardComparisonRow[] = [];
    for (const id of input.manualTimeStandardIds) {
      const standard = await this.repository.getById(id, tenantId);
      const warnings: CalculationIssue[] = [];
      if (!standard) {
        warnings.push({ code: "MANUAL_STANDARD_NOT_FOUND", severity: "warning", message: `ManualTimeStandard "${id}" nebyl nalezen.` });
        rows.push({ standardId: id, standardName: "?", standardVersion: "?", source: "system_default", baseTimeMin: Number.POSITIVE_INFINITY, timeDeltaMin: 0, confidenceHint: 0, warnings });
        continue;
      }
      if (standard.isArchived) {
        warnings.push({ code: "MANUAL_STANDARD_DEFAULTED", severity: "information", message: `ManualTimeStandard "${id}" je archivovaný.` });
      }
      rows.push({
        standardId: standard.id,
        standardName: standard.standardName,
        standardVersion: standard.standardVersion,
        source: standard.source,
        baseTimeMin: standard.baseTimeMin,
        timeDeltaMin: 0,
        confidenceHint: SOURCE_CONFIDENCE_HINT[standard.source],
        warnings,
      });
    }

    rows.sort((a, b) => a.baseTimeMin - b.baseTimeMin);
    const fastest = rows[0]?.baseTimeMin ?? 0;
    for (const row of rows) {
      row.timeDeltaMin = Number.isFinite(row.baseTimeMin) ? row.baseTimeMin - fastest : Number.POSITIVE_INFINITY;
    }

    return { rows };
  }
}
