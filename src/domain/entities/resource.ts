import { ValidationError } from "../errors/validation-error";
import { HourlyRate } from "../value-objects/hourly-rate";
import { ExternalReference } from "../value-objects/external-reference";
import { EntityStav } from "./operation-type";
import { Machine } from "./machine";
import { ResourceCapability } from "./resource-capability";

/** Číselník typů zdroje - dnes jediná hodnota "machine", připraveno na budoucí
 *  "cooperation" (kooperace), "inspection-station" (kontrolní pracoviště),
 *  "fixture" (přípravek) beze změny FK na Operation.resourceId. */
export type ResourceType = "machine" | string;

export interface ResourceProps {
  id: string;
  nazev: string;
  resourceType: ResourceType;
  sazba: HourlyRate;
  stav: EntityStav;
  poznamka?: string;
  externalRefs?: ExternalReference[];
}

/** Obecný výrobní zdroj, na který se přiřazuje Operation - Aggregate Root nad
 *  Machine (detail) a ResourceCapability. Zavedeno místo přímé entity Machine, aby
 *  budoucí přidání kooperace/kontroly/přípravků nevyžadovalo přejmenování FK
 *  napříč aplikací (viz report, bod 4 revize v3). */
export class Resource {
  private capabilities: ResourceCapability[] = [];

  private constructor(
    private props: ResourceProps,
    private machineDetail?: Machine
  ) {}

  static createMachine(props: Omit<ResourceProps, "resourceType">, machineDetail: Machine): Resource {
    if (!props.nazev.trim()) throw new ValidationError("Resource: 'nazev' nesmí být prázdný.");
    if (machineDetail.id !== props.id) {
      throw new ValidationError("Resource: Machine detail musí mít stejné id jako Resource.");
    }
    return new Resource({ ...props, resourceType: "machine", externalRefs: props.externalRefs ?? [] }, machineDetail);
  }

  static restore(props: ResourceProps, machineDetail: Machine | undefined, capabilities: ResourceCapability[]): Resource {
    const resource = new Resource({ ...props, externalRefs: props.externalRefs ?? [] }, machineDetail);
    resource.capabilities = [...capabilities];
    return resource;
  }

  get id(): string {
    return this.props.id;
  }
  get nazev(): string {
    return this.props.nazev;
  }
  get resourceType(): ResourceType {
    return this.props.resourceType;
  }
  get sazba(): HourlyRate {
    return this.props.sazba;
  }
  get stav(): EntityStav {
    return this.props.stav;
  }
  get poznamka(): string | undefined {
    return this.props.poznamka;
  }
  get externalRefs(): readonly ExternalReference[] {
    return this.props.externalRefs ?? [];
  }
  /** Vyplněno jen pro resourceType === "machine". */
  get machine(): Machine | undefined {
    return this.machineDetail;
  }
  get resourceCapabilities(): readonly ResourceCapability[] {
    return this.capabilities;
  }

  addCapability(id: string, operationTypeId: string, parametry?: Record<string, unknown>): ResourceCapability {
    const capability = ResourceCapability.create({ id, resourceId: this.props.id, operationTypeId, parametry });
    this.capabilities.push(capability);
    return capability;
  }

  removeCapability(capabilityId: string): void {
    this.capabilities = this.capabilities.filter((c) => c.id !== capabilityId);
  }

  supports(operationTypeId: string): boolean {
    return this.capabilities.some((c) => c.operationTypeId === operationTypeId);
  }

  setSazba(sazba: HourlyRate): void {
    this.props.sazba = sazba;
  }

  setStav(stav: EntityStav): void {
    this.props.stav = stav;
  }
}
