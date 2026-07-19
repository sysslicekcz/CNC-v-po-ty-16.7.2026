import { ValidationError } from "../errors/validation-error";
import { CuttingParameters } from "../value-objects/cutting-parameters";
import { EntityStav } from "./common";

export type MachiningMode = "roughing" | "finishing" | "universal";

/** Odkud hodnota pochází (Krok 5, zadání bod 20) - čistě informativní
 *  metadata pro důvěryhodnost záznamu, nemění vyhodnocení v resolveru. */
export type CuttingConditionSource = "manufacturer" | "internal" | "calculated" | "manual";

export interface ToolMachineConditionProps {
  id: string;
  tenantId: string;
  toolId: string;
  machineId: string;
  parameters: CuttingParameters;
  stav: EntityStav;
  operationTypeId?: string;
  /** Odkaz na `Material` (Krok 5 - pole existovalo od Kroku 3 jako připravené,
   *  teď má konečně entitu, na kterou reálně ukazuje). */
  materialId?: string;
  machiningMode?: MachiningMode;
  priority?: number;
  source?: CuttingConditionSource;
  note?: string;
}

/** Profil řezných podmínek nástroje na konkrétním stroji - NENÍ to jediná unikátní
 *  kombinace (tool, machine): pro stejnou dvojici může existovat víc profilů
 *  rozlišených podle operationTypeId/materialId/machiningMode a priority (viz
 *  services/cutting-condition-resolver.ts pro výběr nejvhodnějšího). Odpovídá
 *  dnešnímu toolRows (klíč strojId:opId), zobecněno na víc profilů. */
export class ToolMachineCondition {
  private constructor(private props: ToolMachineConditionProps) {}

  static create(props: ToolMachineConditionProps): ToolMachineCondition {
    if (!props.tenantId.trim()) throw new ValidationError("ToolMachineCondition: 'tenantId' nesmí být prázdné.");
    if (!props.toolId.trim()) throw new ValidationError("ToolMachineCondition: 'toolId' nesmí být prázdné.");
    if (!props.machineId.trim()) throw new ValidationError("ToolMachineCondition: 'machineId' nesmí být prázdné.");
    return new ToolMachineCondition({ ...props });
  }

  static restore(props: ToolMachineConditionProps): ToolMachineCondition {
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
  get source(): CuttingConditionSource | undefined {
    return this.props.source;
  }
  get note(): string | undefined {
    return this.props.note;
  }

  updateDetails(input: {
    parameters?: CuttingParameters;
    operationTypeId?: string;
    materialId?: string;
    machiningMode?: MachiningMode;
    priority?: number;
    source?: CuttingConditionSource;
    note?: string;
  }): void {
    if (input.parameters !== undefined) this.props.parameters = input.parameters;
    if (input.operationTypeId !== undefined) this.props.operationTypeId = input.operationTypeId || undefined;
    if (input.materialId !== undefined) this.props.materialId = input.materialId || undefined;
    if (input.machiningMode !== undefined) this.props.machiningMode = input.machiningMode;
    if (input.priority !== undefined) this.props.priority = input.priority;
    if (input.source !== undefined) this.props.source = input.source;
    if (input.note !== undefined) this.props.note = input.note || undefined;
  }

  setStav(stav: EntityStav): void {
    this.props.stav = stav;
  }
}
