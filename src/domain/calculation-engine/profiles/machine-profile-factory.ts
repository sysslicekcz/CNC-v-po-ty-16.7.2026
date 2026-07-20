import { ValidationError } from "@/domain/errors/validation-error";
import { Machine } from "@/domain/entities/machine";
import { MachineProfile } from "./machine-profile";
import { ExternalReferenceSummary } from "../shared/external-reference-summary";
import { MachineCapabilitySummary } from "../shared/machine-capability-summary";
import { MachineWorkEnvelope } from "./machine-work-envelope";

export interface CreateMachineProfileFromMachineInput {
  /** Nové `id` PROFILU - záměrně odlišné od `machine.id`, generuje ho volající
   *  (Application vrstva), viz komentář u `MachineProfile`. */
  id: string;
  machine: Machine;
  siteId?: string;
  workEnvelope?: MachineWorkEnvelope;
  maxPartDimensions?: MachineWorkEnvelope;
  maxPartWeightKg?: number;
  availableFunctions?: readonly MachineCapabilitySummary[];
  externalReferences?: readonly ExternalReferenceSummary[];
  powerCoefficient?: number;
  ageCoefficient?: number;
  conditionCoefficient?: number;
  now: string;
}

/**
 * `MachineProfileFactory` (AP-MCE-001 Fáze B §3) - čistá tovární funkce nad
 * už NAČTENÝM `Machine` (Application vrstva ho dotáhne přes existující
 * `MachineRepository`). `logicalWorkstationId` se PŘEVEZME z
 * `machine.capacityGroupId` - nejde zadat jinak, aby profil nikdy neukazoval
 * na jiné pracoviště, než ke kterému fyzický stroj skutečně patří
 * (AP-MCE-001 Fáze B §3: "logické pracoviště oproti fyzickému stroji").
 */
export class MachineProfileFactory {
  static createFromMachine(input: CreateMachineProfileFromMachineInput): MachineProfile {
    if (!input.id.trim()) throw new ValidationError("MachineProfileFactory: 'id' nesmí být prázdné.");

    return MachineProfile.create({
      id: input.id,
      tenantId: input.machine.tenantId,
      siteId: input.siteId,
      externalReferences: input.externalReferences ?? [],
      manufacturer: input.machine.manufacturer,
      model: input.machine.model,
      machineCategory: input.machine.category,
      logicalWorkstationId: input.machine.capacityGroupId,
      physicalMachineId: input.machine.id,
      maxRpm: input.machine.maxRpm,
      maxPowerKw: input.machine.maxPowerKw,
      workEnvelope: input.workEnvelope,
      maxPartDimensions: input.maxPartDimensions,
      maxPartWeightKg: input.maxPartWeightKg,
      availableFunctions: input.availableFunctions ?? [],
      powerCoefficient: input.powerCoefficient ?? 1,
      ageCoefficient: input.ageCoefficient ?? 1,
      conditionCoefficient: input.conditionCoefficient ?? 1,
      typicalSetupTimes: [],
      recordVersion: 1,
      createdAt: input.now,
      updatedAt: input.now,
    });
  }
}
