import { ValidationError } from "../errors/validation-error";
import { CuttingParameters } from "../value-objects/cutting-parameters";

export interface ToolMachineConditionProps {
  id: string;
  toolId: string;
  machineId: string;
  parametry: CuttingParameters;
  materialId?: string; // budoucí - odlišné podmínky podle obráběného materiálu
  rezim?: "hrubovani" | "dokoncovani"; // budoucí
}

/** Malý samostatný agregát spojující Tool a Machine (dva jiné agregáty) - řezné
 *  podmínky konkrétního nástroje na konkrétním stroji, jako override výchozích
 *  hodnot z Tool.vychoziParametry. Odpovídá dnešnímu toolRows (klíč strojId:opId).
 *  Zůstává vázaná na Machine, ne na obecný Resource - Vc/f/ap dávají smysl jen
 *  pro obráběcí stroje. */
export class ToolMachineCondition {
  private constructor(private props: ToolMachineConditionProps) {}

  static create(props: ToolMachineConditionProps): ToolMachineCondition {
    if (!props.toolId.trim()) throw new ValidationError("ToolMachineCondition: 'toolId' nesmí být prázdné.");
    if (!props.machineId.trim()) throw new ValidationError("ToolMachineCondition: 'machineId' nesmí být prázdné.");
    return new ToolMachineCondition({ ...props });
  }

  get id(): string {
    return this.props.id;
  }
  get toolId(): string {
    return this.props.toolId;
  }
  get machineId(): string {
    return this.props.machineId;
  }
  get parametry(): CuttingParameters {
    return this.props.parametry;
  }
  get materialId(): string | undefined {
    return this.props.materialId;
  }
  get rezim(): "hrubovani" | "dokoncovani" | undefined {
    return this.props.rezim;
  }

  setParametry(parametry: CuttingParameters): void {
    this.props.parametry = parametry;
  }
}
