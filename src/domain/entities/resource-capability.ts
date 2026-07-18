export interface ResourceCapabilityProps {
  id: string;
  resourceId: string;
  operationTypeId: string;
  /** Volný prostor pro budoucí limity capability (max. rozměr apod.) bez zásahu
   *  do databázového schématu. */
  parametry?: Record<string, unknown>;
}

/** Který typ operace daný zdroj umí provádět. Nahrazuje dnešní ploché
 *  Machine.operace: string[]. */
export class ResourceCapability {
  private constructor(private readonly props: ResourceCapabilityProps) {}

  static create(props: ResourceCapabilityProps): ResourceCapability {
    return new ResourceCapability({ ...props });
  }

  get id(): string {
    return this.props.id;
  }
  get resourceId(): string {
    return this.props.resourceId;
  }
  get operationTypeId(): string {
    return this.props.operationTypeId;
  }
  get parametry(): Record<string, unknown> | undefined {
    return this.props.parametry;
  }
}
