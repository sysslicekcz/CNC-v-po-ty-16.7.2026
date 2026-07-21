import { CalculationContext } from "@/domain/calculation-engine/contracts/calculation-context";
import { RuleRepository } from "@/domain/calculation-engine/repositories/rule-repository";
import { InspectionEquipmentProfileRepository } from "@/domain/calculation-engine/repositories/inspection-equipment-profile-repository";
import { CalculationError } from "@/domain/calculation-engine/errors/calculation-error";
import { InspectionCalculationInput } from "@/domain/calculation-engine/inspection/inspection-calculation-input";
import { InspectionEquipmentProfileSnapshot } from "@/domain/calculation-engine/inspection/inspection-equipment-profile-snapshot";
import { syntheticInspectionFeatures } from "@/domain/calculation-engine/inspection/inspection-synthetic-features";

/** Zúžený tvar `InspectionCalculationContextBuilder` (jen `build`) - stejný
 *  důvod jako `ManualOperationCalculationContextBuilderPort`. */
export type InspectionCalculationContextBuilderPort = Pick<InspectionCalculationContextBuilder, "build">;

/**
 * `InspectionCalculationContextBuilder` (AP-MCE-001 Fáze F §9/§14) -
 * Application-vrstvá služba, KTERÁ SMÍ volat repozitáře. Pro každý feature s
 * vyplněným (přímo nebo přes operaci) `equipmentId` načte `InspectionEquipment
 * ProfileSnapshot` a zároveň (jen tady, kde smí přistoupit k hodinám -
 * `InspectionCalculationStrategy` sama zůstává čistá funkce, viz komentář u
 * `CalculationContext.inspectionEquipmentCalibrationExpiredByFeatureId`)
 * vyhodnotí `InspectionEquipmentProfile.isCalibrationExpiredAt(now)`.
 */
export class InspectionCalculationContextBuilder {
  constructor(
    private readonly ruleRepository: RuleRepository,
    private readonly inspectionEquipmentProfileRepository: InspectionEquipmentProfileRepository
  ) {}

  async build(input: InspectionCalculationInput, tenantId: string): Promise<CalculationContext> {
    const now = new Date().toISOString();

    const ruleVersion = input.ruleVersionId
      ? await this.ruleRepository.findById(input.ruleVersionId, tenantId)
      : await this.ruleRepository.findActiveVersion(tenantId);
    if (!ruleVersion) {
      throw new CalculationError(
        input.ruleVersionId ? `Verze pravidel "${input.ruleVersionId}" nebyla nalezena.` : `Pro organizaci "${tenantId}" není nastavená žádná aktivní verze výpočtových pravidel.`
      );
    }

    const inspectionEquipmentSnapshotsByFeatureId: Record<string, InspectionEquipmentProfileSnapshot> = {};
    const inspectionEquipmentCalibrationExpiredByFeatureId: Record<string, boolean> = {};

    for (const feature of syntheticInspectionFeatures(input)) {
      const equipmentId = feature.equipmentId ?? input.inspectionEquipmentIds?.[0];
      if (!equipmentId) continue;

      const equipment = await this.inspectionEquipmentProfileRepository.getById(equipmentId, tenantId);
      if (!equipment) continue;

      inspectionEquipmentSnapshotsByFeatureId[feature.id] = InspectionEquipmentProfileSnapshot.forInspectionEquipmentProfile(equipment, {
        systemVersion: equipment.recordVersion,
        createdAt: now,
      });
      inspectionEquipmentCalibrationExpiredByFeatureId[feature.id] = equipment.isCalibrationExpiredAt(now);
    }

    return {
      ruleVersion,
      inspectionEquipmentSnapshotsByFeatureId,
      inspectionEquipmentCalibrationExpiredByFeatureId,
    };
  }
}
