import { ValidationError } from "../errors/validation-error";
import { TenantCode } from "../value-objects/tenant-code";

export type TenantStatus = "active" | "trial" | "suspended" | "inactive";

/** Výchozí lokální tenant (Krok 3.5, bod 10) - dokud appka zůstává
 *  jednouživatelská/offline, všechna existující i nově migrovaná TPV data
 *  patří jemu. */
export const DEFAULT_TENANT_ID = "tenant:local-default";

export interface TenantProps {
  id: string;
  code: TenantCode;
  name: string;
  status: TenantStatus;
}

/** Zákaznická organizace PROVOZUJÍCÍ tuhle appku - ne totéž co doménový
 *  Customer (obchodní zákazník, pro kterého Tenant vyrábí). Viz docs/adr/0019.
 *  Dnes existuje jediný `tenant:local-default`, model ale počítá s víc
 *  organizacemi (bod 3 zadání). */
export class Tenant {
  private constructor(private props: TenantProps) {}

  static create(props: TenantProps): Tenant {
    if (!props.name.trim()) throw new ValidationError("Tenant: 'name' nesmí být prázdné.");
    return new Tenant({ ...props });
  }

  static restore(props: TenantProps): Tenant {
    return new Tenant({ ...props });
  }

  get id(): string {
    return this.props.id;
  }
  get code(): TenantCode {
    return this.props.code;
  }
  get name(): string {
    return this.props.name;
  }
  get status(): TenantStatus {
    return this.props.status;
  }

  get isActive(): boolean {
    return this.props.status === "active" || this.props.status === "trial";
  }

  setStatus(status: TenantStatus): void {
    this.props.status = status;
  }
}
