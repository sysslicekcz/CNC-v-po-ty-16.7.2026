import { ValidationError } from "../errors/validation-error";
import { CapacityGroupCode } from "../value-objects/capacity-group-code";

export type CapacityGroupStatus = "active" | "inactive";

export interface CapacityGroupProps {
  id: string;
  tenantId: string;
  code: CapacityGroupCode;
  name: string;
  status: CapacityGroupStatus;
  note?: string;
}

/**
 * Sdílená fyzická kapacita, kterou reprezentuje víc podnikových kódů/strojů
 * (Krok 3.5, bod 13, docs/adr/0017) - např. `300-58140`/`300-58141` jsou dva
 * odlišné `Machine` záznamy (vlastní id, vlastní code), obě se jen odkazují na
 * stejnou `CapacityGroup` přes `Machine.capacityGroupId`. Tenhle krok
 * neimplementuje žádné plánování/kalendáře/Gantt - jen model a persistenci.
 */
export class CapacityGroup {
  private constructor(private props: CapacityGroupProps) {}

  static create(props: CapacityGroupProps): CapacityGroup {
    if (!props.tenantId.trim()) throw new ValidationError("CapacityGroup: 'tenantId' nesmí být prázdné.");
    if (!props.name.trim()) throw new ValidationError("CapacityGroup: 'name' nesmí být prázdné.");
    return new CapacityGroup({ ...props });
  }

  static restore(props: CapacityGroupProps): CapacityGroup {
    return new CapacityGroup({ ...props });
  }

  get id(): string {
    return this.props.id;
  }
  get tenantId(): string {
    return this.props.tenantId;
  }
  get code(): CapacityGroupCode {
    return this.props.code;
  }
  get name(): string {
    return this.props.name;
  }
  get status(): CapacityGroupStatus {
    return this.props.status;
  }
  get note(): string | undefined {
    return this.props.note;
  }

  rename(name: string): void {
    if (!name.trim()) throw new ValidationError("CapacityGroup: 'name' nesmí být prázdné.");
    this.props.name = name;
  }

  setStatus(status: CapacityGroupStatus): void {
    this.props.status = status;
  }
}
