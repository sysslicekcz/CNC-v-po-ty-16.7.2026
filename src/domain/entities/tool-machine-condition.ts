import { ValidationError } from "../errors/validation-error";
import { CuttingParameters } from "../value-objects/cutting-parameters";
import { EntityStav } from "./common";

export type MachiningMode = "roughing" | "finishing" | "universal";

export interface ToolMachineConditionProps {
  id: string;
  tenantId: string;
  toolId: string;
  machineId: string;
  parameters: CuttingParameters;
  stav: EntityStav;
  operationTypeId?: string;
  materialId?: string; // budoucí - odlišné podmínky podle obráběného materiálu
  machiningMode?: MachiningMode;
  priority?: number;
}

/** Profil řezných podmínek nástroje na konkrétním stroji - NENÍ to jediná unikátní
 *  kombinace (tool, machine): pro stejnou dvojici může existovat víc profilů
 *  rozlišených podle operationTypeId/materialId/machiningMode a priority (viz
 *  services/cutting-condition-resolver.ts pro výběr nejvhodnějšího). Odpovídá
 *  dnešnímu toolRows (klíč strojId:opId), zobecněno na víc profilů. */
export class ToolMachineCondition {
  private constructor(private readonly props: ToolMachineConditionProps) {}

  static create(props: ToolMachineConditionProps): ToolMachineCondition {
    if (!props.tenantId.trim()) throw new ValidationError("ToolMachineCondition: 'tenantId' nesmí být prázdné.");
    if (!props.toolId.trim()) throw new ValidationError("ToolMachineCondition: 'toolId' nesmí být prázdné.");
    if (!props.machineId.trim()) throw new ValidationError("ToolMachineCondition: 'machineId' nesmí být prázdné.");
    return new ToolMachineCondition({ ...props });
  }

  get id(): string {
    return this.props.id;
  }
  get tenantId(): string {
    return this.props.tenantId;
  }
  get toolId(): string {
    return this.props.toolId;
  }
  get machineId(): string {
    return this.props.machineId;
  }
  get parameters(): CuttingParameters {
    return this.props.parameters;
  }
  get stav(): EntityStav {
    return this.props.stav;
  }
  get operationTypeId(): string | undefined {
    return this.props.operationTypeId;
  }
  get materialId(): string | undefined {
    return this.props.materialId;
  }
  get machiningMode(): MachiningMode | undefined {
    return this.props.machiningMode;
  }
  get priority(): number | undefined {
    return this.props.priority;
  }
}
