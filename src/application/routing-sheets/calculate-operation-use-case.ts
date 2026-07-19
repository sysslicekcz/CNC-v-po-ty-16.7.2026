import { RoutingSheet } from "@/domain/aggregates/routing-sheet/routing-sheet";
import { Calculation } from "@/domain/aggregates/routing-sheet/calculation";
import { CalculationInputRow, CalculationSnapshot } from "@/domain/aggregates/routing-sheet/types";
import { CalculationEngine, CURRENT_ALGORITHM_VERSION } from "@/domain/services/calculation-engine";
import { MachineRepository } from "@/domain/repositories/machine-repository";
import { ToolRepository } from "@/domain/repositories/tool-repository";
import { OperationTypeRepository } from "@/domain/repositories/operation-type-repository";
import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { NotFoundError } from "@/domain/errors/not-found-error";

export interface CalculateOperationCommand {
  /** Agregát, JAK HO PRÁVĚ DRŽÍ editor (ne znovu načtený) - use case ho mutuje
   *  in-memory přes `recordCalculation()`, perzistenci provede až samostatný
   *  `SaveRoutingSheetDraftUseCase` (zadání bod 43 - "rozděl editorové lokální
   *  mutace a aplikační uložení aggregate"). */
  routingSheet: RoutingSheet;
  operationId: string;
  positionId: string;
  activityId: string;
  calculationType: string;
  inputParameters: CalculationInputRow[];
}

/**
 * Napojení na EXISTUJÍCÍ kalkulační engine (Krok 4, zadání bod 22) - žádný
 * druhý engine, jen adaptér přes doménový port `CalculationEngine`
 * (`LegacyCalculationEngine` v infrastructure/calculation). Sestaví
 * `CalculationSnapshot` se zamrzlou identitou/cenou stroje a nástroje V
 * OKAMŽIKU VÝPOČTU (docs/adr/0006) a zapíše novou immutable `Calculation` přes
 * `RoutingSheet.recordCalculation()` - nikdy neupravuje předchozí instanci.
 *
 * Licence: dnešní kalkulační engine nerozlišuje "základní"/"pokročilé" typy
 * výpočtu na úrovni dat (`OPERATIONS`/`OperationType` žádnou takovou
 * klasifikaci nemá) - kontroluje se proto jen `calculations.basic`.
 * `calculations.advanced` je připravený licenční hák pro budoucí pokročilé
 * kalkulační typy, až vzniknou (viz docs/step-4/known-limitations.md) - dnes
 * by ho nebylo možné vynutit, aniž by appka fabrikovala klasifikaci, kterou
 * číselník neobsahuje.
 */
export class CalculateOperationUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly machineRepository: MachineRepository,
    private readonly toolRepository: ToolRepository,
    private readonly operationTypeRepository: OperationTypeRepository,
    private readonly calculationEngine: CalculationEngine,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(command: CalculateOperationCommand): Promise<Calculation> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    if (command.routingSheet.tenantId !== tenantId) {
      throw new NotFoundError("RoutingSheet", command.routingSheet.id);
    }
    await this.featureAccessService.require(FeatureCodes.CalculationsBasic, "write");

    const operation = command.routingSheet.getOperation(command.operationId);
    const activity = operation.getPosition(command.positionId).getActivity(command.activityId);

    const machine = operation.machineId ? await this.machineRepository.findById(operation.machineId, tenantId) : null;
    const tool = activity.toolId ? await this.toolRepository.findById(activity.toolId, tenantId) : null;
    const operationType = await this.operationTypeRepository.findById(activity.operationTypeId, tenantId);

    const result = this.calculationEngine.compute(command.calculationType, command.inputParameters, CURRENT_ALGORITHM_VERSION);

    const snapshot: CalculationSnapshot = {
      machineId: machine?.id,
      machineCode: machine?.code?.toString(),
      machineName: machine?.name,
      machineHourlyRate: machine ? machine.hourlyRate.toJSON() : undefined,
      toolId: tool?.id,
      toolCode: tool?.code?.toString(),
      toolName: tool?.nazev,
      toolTypeId: tool?.toolTypeId,
      operationTypeId: activity.operationTypeId,
      operationTypeCode: operationType?.kod ?? activity.operationTypeId,
      calculatedAt: new Date().toISOString(),
      calculationEngineVersion: CURRENT_ALGORITHM_VERSION,
    };

    return command.routingSheet.recordCalculation(command.operationId, command.positionId, command.activityId, {
      id: crypto.randomUUID(),
      inputParameters: command.inputParameters,
      result,
      algorithmVersion: CURRENT_ALGORITHM_VERSION,
      snapshot,
    });
  }
}
