import { TenantContext } from "@/domain/services/tenant-context";
import { MaterialRepository } from "@/domain/repositories/material-repository";
import { MachineRepository } from "@/domain/repositories/machine-repository";
import { ToolRepository } from "@/domain/repositories/tool-repository";
import { NotFoundError } from "@/domain/errors/not-found-error";
import { MaterialError } from "@/domain/calculation-engine/errors/material-error";
import { ToolError } from "@/domain/calculation-engine/errors/tool-error";
import { CalculationError } from "@/domain/calculation-engine/errors/calculation-error";
import { CalculationRepository } from "@/domain/calculation-engine/repositories/calculation-repository";
import { RuleRepository } from "@/domain/calculation-engine/repositories/rule-repository";
import { CalculationEngine } from "@/domain/calculation-engine/services/calculation-engine";
import { CalculationRequest } from "@/domain/calculation-engine/entities/calculation-request";
import { CalculationResult } from "@/domain/calculation-engine/entities/calculation-result";
import { OperationCalculationInput } from "../dto/operation-calculation-input";
import { OperationCalculationOutput } from "../dto/operation-calculation-output";
import { toOperationCalculationOutput } from "../mappers/calculation-result-mapper";
import { computeConfidenceScore } from "../confidence-score";

/**
 * Orchestrace jednoho výpočtu operace (AP-MCE-001 §12 `POST /calculations/
 * operations`, §21 Fáze A "round-trips a trivial manual operation").
 *
 * Co use case dělá (I/O, tenant scoping, persistence) a co NE (technologické
 * vzorce) je přesně hranice z AP-MCE-001 §01 "jak zajistit, aby výpočetní
 * logika nebyla uvnitř UI" rozšířená i na Application vrstvu - veškerá
 * doménová matematika žije v `CalculationEngine`/`CalculationStrategy`
 * (Domain), tenhle use case jen: ověří existenci vstupů, sestaví kontext,
 * zavolá doménovou službu a výsledek uloží.
 *
 * "material exists"/"machine exists"/"tool exists" (AP-MCE-001 §18) se ověřují
 * PŘÍMO přes existující `MaterialRepository`/`MachineRepository`/
 * `ToolRepository` - Fáze A záměrně NEBUDUJE `MaterialProfile`/`MachineProfile`/
 * `ToolProfile` (AP-MCE-001 §06-08 patří až do Fáze B), existenční kontrola
 * ale nemá důvod na tenhle bohatší profil čekat.
 *
 * TODO(Fáze H): až vznikne REST API a `ManufacturingCalculationEngineAdapter`,
 * tenhle use case zůstává - adaptér ho volá místo `LegacyCalculationEngine`
 * uvnitř existujícího `CalculateOperationUseCase` z routing-sheet editoru
 * (dva různé use casy stejného jména v různých modulech - to je záměr, viz
 * AP-MCE-001 §00).
 * TODO(licencování): až přibudou `calculation.*` feature codes (AP-MCE-001
 * §16), tenhle use case musí na začátku volat `FeatureAccessService.require
 * (FeatureCodes.CalculationCreate, "write")` stejně jako všechny ostatní use
 * casy v appce (`schování tlačítka v UI NIKDY není jediná ochrana`) - Fáze A
 * se cíleně omezuje na 3 nové adresáře (`domain|application|infrastructure/
 * calculation-engine`) a nesahá na sdílený `domain/licensing/feature-code.ts`.
 */
export class CalculateOperationUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly calculationRepository: CalculationRepository,
    private readonly ruleRepository: RuleRepository,
    private readonly materialRepository: MaterialRepository,
    private readonly machineRepository: MachineRepository,
    private readonly toolRepository: ToolRepository,
    private readonly calculationEngine: CalculationEngine
  ) {}

  async execute(input: OperationCalculationInput): Promise<OperationCalculationOutput> {
    const tenantId = this.tenantContext.requireCurrentTenantId();

    const existing = await this.findExistingResultForIdempotencyKey(input.idempotencyKey, tenantId);
    if (existing) return toOperationCalculationOutput(existing);

    await this.assertReferencedEntitiesExist(input, tenantId);
    const ruleVersion = await this.resolveRuleVersion(input.ruleVersionId, tenantId);

    const request = CalculationRequest.create({
      id: crypto.randomUUID(),
      tenantId,
      operationCategory: input.operationCategory,
      operationTypeId: input.operationTypeId,
      idempotencyKey: input.idempotencyKey,
      inputSnapshot: { ...input },
      ruleVersionId: ruleVersion.id,
      requestedAt: new Date().toISOString(),
      requestedBy: input.requestedBy,
    });
    await this.calculationRepository.saveRequest(request);

    const outcome = this.calculationEngine.calculate(input, { ruleVersion });
    const calculatedAt = new Date().toISOString();

    const result = outcome.blocked
      ? CalculationResult.create({
          id: crypto.randomUUID(),
          tenantId,
          calculationRequestId: request.id,
          status: "failed",
          issues: outcome.issues,
          engineVersion: this.calculationEngine.engineVersion,
          strategyVersion: outcome.strategyVersion,
          ruleVersionId: ruleVersion.id,
          calculatedAt,
        })
      : CalculationResult.create({
          id: crypto.randomUUID(),
          tenantId,
          calculationRequestId: request.id,
          status: outcome.issues.some((issue) => issue.severity === "warning") ? "completed_with_warnings" : "completed",
          breakdown: outcome.breakdown,
          confidenceScore: computeConfidenceScore(outcome.issues),
          issues: outcome.issues,
          engineVersion: this.calculationEngine.engineVersion,
          strategyVersion: outcome.strategyVersion,
          ruleVersionId: ruleVersion.id,
          calculatedAt,
        });

    await this.calculationRepository.saveResult(result);
    return toOperationCalculationOutput(result);
  }

  /** AP-MCE-001 §12 idempotence - opakované volání se stejným klíčem vrátí
   *  původní výsledek místo druhého výpočtu. Fáze A nekontroluje, že i
   *  zbytek vstupu je shodný (API kontrakt "jiný payload = 409" čeká na
   *  Fázi H, kde je HTTP vrstva, která to umí vrátit jako chybu). */
  private async findExistingResultForIdempotencyKey(idempotencyKey: string, tenantId: string): Promise<CalculationResult | null> {
    const existingRequest = await this.calculationRepository.findRequestByIdempotencyKey(idempotencyKey, tenantId);
    if (!existingRequest) return null;
    const [latestResult] = await this.calculationRepository.findResultsByRequestId(existingRequest.id, tenantId);
    return latestResult ?? null;
  }

  private async assertReferencedEntitiesExist(input: OperationCalculationInput, tenantId: string): Promise<void> {
    const material = await this.materialRepository.findById(input.materialId, tenantId);
    if (!material) throw MaterialError.notFound(input.materialId);

    if (input.machineId) {
      const machine = await this.machineRepository.findById(input.machineId, tenantId);
      if (!machine) throw new NotFoundError("Machine", input.machineId);
    }

    if (input.toolId) {
      const tool = await this.toolRepository.findById(input.toolId, tenantId);
      if (!tool) throw ToolError.notFound(input.toolId);
    }
  }

  private async resolveRuleVersion(ruleVersionId: string | undefined, tenantId: string) {
    const ruleVersion = ruleVersionId
      ? await this.ruleRepository.findById(ruleVersionId, tenantId)
      : await this.ruleRepository.findActiveVersion(tenantId);

    if (!ruleVersion) {
      throw new CalculationError(
        ruleVersionId
          ? `Verze pravidel "${ruleVersionId}" nebyla nalezena.`
          : `Pro organizaci "${tenantId}" není nastavená žádná aktivní verze výpočtových pravidel.`
      );
    }
    return ruleVersion;
  }
}
