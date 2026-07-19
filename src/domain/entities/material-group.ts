import { ValidationError } from "../errors/validation-error";
import { MaterialGroupCode } from "../value-objects/material-group-code";
import { MasterDataStatus } from "./master-data-status";

export interface MaterialGroupProps {
  id: string;
  tenantId: string;
  code: MaterialGroupCode;
  name: string;
  status: MasterDataStatus;
}

/** Materiálová skupina (Krok 5, zadání bod 22) - např. "konstrukční ocel",
 *  "nerez", "hliník". Používá ji `ToolMachineCondition.materialId`
 *  (přes `Material.materialGroupId`) a `resolveCuttingConditions` pro filtr
 *  podle skupiny. */
export class MaterialGroup {
  private constructor(private props: MaterialGroupProps) {}

  static create(props: MaterialGroupProps): MaterialGroup {
    if (!props.tenantId.trim()) throw new ValidationError("MaterialGroup: 'tenantId' nesmí být prázdné.");
    if (!props.name.trim()) throw new ValidationError("MaterialGroup: 'name' nesmí být prázdný.");
    return new MaterialGroup({ ...props });
  }

  static restore(props: MaterialGroupProps): MaterialGroup {
    return new MaterialGroup({ ...props });
  }

  get id(): string {
    return this.props.id;
  }
  get tenantId(): string {
    return this.props.tenantId;
  }
  get code(): MaterialGroupCode {
    return this.props.code;
  }
  get name(): string {
    return this.props.name;
  }
  get status(): MasterDataStatus {
    return this.props.status;
  }

  rename(name: string): void {
    if (!name.trim()) throw new ValidationError("MaterialGroup: 'name' nesmí být prázdný.");
    this.props.name = name;
  }

  setStatus(status: MasterDataStatus): void {
    this.props.status = status;
  }
}
