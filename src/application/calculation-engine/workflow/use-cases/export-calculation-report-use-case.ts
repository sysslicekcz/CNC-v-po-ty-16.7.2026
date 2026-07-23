import { TenantContext } from "@/domain/services/tenant-context";
import { CalculationRepository } from "@/domain/calculation-engine/repositories/calculation-repository";
import { CalculationError } from "@/domain/calculation-engine/errors/calculation-error";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";

export interface CalculationReport {
  calculationId: string;
  calculationRequestId: string;
  operationCategory: string;
  operationTypeId: string;
  inputSnapshot: Readonly<Record<string, unknown>>;
  status: string;
  breakdown?: Record<string, unknown>;
  materialProfileSnapshot?: Readonly<Record<string, unknown>>;
  machineProfileSnapshot?: Readonly<Record<string, unknown>>;
  toolProfileSnapshot?: Readonly<Record<string, unknown>>;
  cuttingConditionSnapshot?: Readonly<Record<string, unknown>>;
  issues: Readonly<unknown[]>;
  confidenceScore?: number;
  /** §25 "Report nesmí prezentovat aproximovaný výsledek jako přesný" -
   *  proto EXPLICITNÍ pole, ne implicitní odvození z `confidenceScore`. */
  isApproximation: boolean;
  engineVersion: string;
  strategyVersion?: string;
  ruleVersionId: string;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  calculatedAt: string;
  requestedBy?: string;
  requestedAt: string;
  exportedAt: string;
  exportFormat: "json";
}

const APPROXIMATE_STRATEGY_MARKERS = ["3d", "simplified", "custom_path"];

/**
 * `ExportCalculationReportUseCase` (AP-MCE-001 Fáze H §25/§36) - MVP export
 * do JSON (§24/§32 "formáty podle existující infrastruktury" - projekt
 * dosud nemá CSV/XLSX/PDF exportér pro `CalculationResult`, jen CSV export
 * pro Kmenová data (`export-csv-button.tsx`) - JSON je jediný formát, který
 * appka dnes umí bezpečně produkovat beze změny mimo Fázi H, viz finální
 * souhrn "zbývající rizika").
 */
export class ExportCalculationReportUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly calculationRepository: CalculationRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(calculationId: string): Promise<CalculationReport> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationRead, "read");

    const result = await this.calculationRepository.findResultById(calculationId, tenantId);
    if (!result) throw new CalculationError(`CalculationResult "${calculationId}" nebyl nalezen.`);
    const request = await this.calculationRepository.findRequestById(result.calculationRequestId, tenantId);
    if (!request) throw new CalculationError(`CalculationRequest "${result.calculationRequestId}" nebyl nalezen.`);

    const inputSnapshot = request.inputSnapshot;
    const subtype = typeof inputSnapshot.subtype === "string" ? inputSnapshot.subtype : "";
    const isApproximation = APPROXIMATE_STRATEGY_MARKERS.some((marker) => subtype.toLowerCase().includes(marker));

    return {
      calculationId: result.id,
      calculationRequestId: result.calculationRequestId,
      operationCategory: request.operationCategory,
      operationTypeId: request.operationTypeId,
      inputSnapshot,
      status: result.status,
      breakdown: result.breakdown?.toJSON(),
      materialProfileSnapshot: result.materialProfileSnapshot,
      machineProfileSnapshot: result.machineProfileSnapshot,
      toolProfileSnapshot: result.toolProfileSnapshot,
      cuttingConditionSnapshot: result.cuttingConditionSnapshot,
      issues: result.issues,
      confidenceScore: result.confidenceScore,
      isApproximation,
      engineVersion: result.engineVersion,
      strategyVersion: result.strategyVersion,
      ruleVersionId: result.ruleVersionId,
      reviewedBy: result.reviewedBy,
      reviewedAt: result.reviewedAt,
      rejectionReason: result.rejectionReason,
      calculatedAt: result.calculatedAt,
      requestedBy: request.requestedBy,
      requestedAt: request.requestedAt,
      exportedAt: new Date().toISOString(),
      exportFormat: "json",
    };
  }
}
