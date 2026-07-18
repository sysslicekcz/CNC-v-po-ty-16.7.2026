import { ValidationError } from "../errors/validation-error";

export interface ExternalReferenceProps {
  system: string; // např. "Helios"
  externalId: string;
  lastSyncAt?: number;
  source?: string;
}

/** Vazba na záznam v externím systému (ERP). Entita může mít víc ExternalReference
 *  najednou - nepředpokládá se propojení jen s jedním systémem. */
export class ExternalReference {
  private constructor(private readonly props: ExternalReferenceProps) {}

  static of(props: ExternalReferenceProps): ExternalReference {
    if (!props.system.trim()) throw new ValidationError("ExternalReference: 'system' nesmí být prázdný.");
    if (!props.externalId.trim()) throw new ValidationError("ExternalReference: 'externalId' nesmí být prázdné.");
    return new ExternalReference({ ...props });
  }

  get system(): string {
    return this.props.system;
  }
  get externalId(): string {
    return this.props.externalId;
  }
  get lastSyncAt(): number | undefined {
    return this.props.lastSyncAt;
  }
  get source(): string | undefined {
    return this.props.source;
  }
}
