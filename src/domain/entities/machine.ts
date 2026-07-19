import { ValidationError } from "../errors/validation-error";
import { HourlyRate } from "../value-objects/hourly-rate";
import { MachineCode } from "../value-objects/machine-code";
import { MasterDataStatus } from "./master-data-status";

export type MachineStatus = MasterDataStatus;

/** Kategorie stroje (Krok 5, zadání bod 5) - volitelné doplňkové zařazení k
 *  ODVOZENÉMU typu z `machine-type-classifier.ts` (ten zůstává zdrojem pravdy
 *  pro zobrazovaný "typ stroje" podle capability/operation types). `category`
 *  je jen uživatelem zadaná klasifikace pro filtrování v seznamu, ne náhrada. */
export type MachineCategory =
  | "lathe"
  | "milling"
  | "turn_mill"
  | "grinding"
  | "drilling"
  | "saw"
  | "inspection"
  | "assembly"
  | "other";

export interface MachineProps {
  id: string;
  tenantId: string;
  code: MachineCode;
  name: string;
  designation?: string;
  category?: MachineCategory;
  manufacturer?: string;
  model?: string;
  maxRpm?: number;
  maxPowerKw?: number;
  hourlyRate: HourlyRate;
  status: MachineStatus;
  note?: string;
  capacityGroupId?: string;
}

/**
 * Stroj je vlastní jednoduchý agregát (vlastní MachineRepository), ne vnitřní
 * entita něčeho jiného. `id` je interní stabilní identita (nikdy se neodvozuje
 * z `name` ani se nepřepisuje kódem z žádného externího systému); `code` je
 * uživatelsky zadávaný podnikový kód, podle kterého bude appka párovat s
 * libovolným připojeným ERP (Helios je jen jeden možný příklad, viz
 * docs/adr/0015, docs/adr/0016, docs/adr/erp-agnostic-integration-layer.md).
 * Anglické názvy polí jsou záměrná výjimka z české konvence zbytku domény -
 * Krok 3.5 je zavádí explicitně kvůli budoucímu ERP-neutrálnímu párování a
 * licenčním datům (viz docs/audits/step-3-5-audit.md).
 *
 * Typ stroje se sem neukládá jako ručně zadané pole - odvozuje se z
 * MachineCapability přes services/machine-type-classifier.ts. Použito je přímo
 * Machine, ne obecná abstrakce Resource (docs/adr/0010) - kooperace se řeší
 * samostatnou entitou ExternalOperationResource (docs/adr/0018), sdílená
 * fyzická kapacita přes CapacityGroup (docs/adr/0017), ne sloučením strojů.
 */
export class Machine {
  private constructor(private props: MachineProps) {}

  static create(props: MachineProps): Machine {
    if (!props.tenantId.trim()) throw new ValidationError("Machine: 'tenantId' nesmí být prázdné.");
    if (!props.name.trim()) throw new ValidationError("Machine: 'name' nesmí být prázdné.");
    return new Machine({ ...props });
  }

  static restore(props: MachineProps): Machine {
    return new Machine({ ...props });
  }

  get id(): string {
    return this.props.id;
  }
  get tenantId(): string {
    return this.props.tenantId;
  }
  get code(): MachineCode {
    return this.props.code;
  }
  get name(): string {
    return this.props.name;
  }
  get designation(): string | undefined {
    return this.props.designation;
  }
  get category(): MachineCategory | undefined {
    return this.props.category;
  }
  get manufacturer(): string | undefined {
    return this.props.manufacturer;
  }
  get model(): string | undefined {
    return this.props.model;
  }
  get maxRpm(): number | undefined {
    return this.props.maxRpm;
  }
  get maxPowerKw(): number | undefined {
    return this.props.maxPowerKw;
  }
  get hourlyRate(): HourlyRate {
    return this.props.hourlyRate;
  }
  get status(): MachineStatus {
    return this.props.status;
  }
  get note(): string | undefined {
    return this.props.note;
  }
  get capacityGroupId(): string | undefined {
    return this.props.capacityGroupId;
  }

  /** Přejmenování nemění `id` ani `code` - žádná vazba (Operation.machineId)
   *  se tím nerozbije. */
  rename(name: string): void {
    if (!name.trim()) throw new ValidationError("Machine: 'name' nesmí být prázdné.");
    this.props.name = name;
  }

  /** Změna kódu nemění `id` - unikátnost nového kódu v rámci tenanta hlídá
   *  use case (repository), ne entita samotná. */
  changeCode(code: MachineCode): void {
    this.props.code = code;
  }

  /** Popisná pole beze změny identity/kódu/stavu (Krok 5) - `undefined` v
   *  argumentu znamená "nezadáno v tomhle volání", ne "smaž hodnotu"; pro
   *  smazání volitelného pole zavolej s prázdným řetězcem/`undefined` explicitně
   *  na vlastnosti, kterou chceš vyprázdnit (stejný vzor jako
   *  `RoutingSheet.updateHeader`). */
  updateDetails(input: {
    designation?: string;
    category?: MachineCategory;
    manufacturer?: string;
    model?: string;
    maxRpm?: number;
    maxPowerKw?: number;
    note?: string;
  }): void {
    if (input.designation !== undefined) this.props.designation = input.designation || undefined;
    if (input.category !== undefined) this.props.category = input.category;
    if (input.manufacturer !== undefined) this.props.manufacturer = input.manufacturer || undefined;
    if (input.model !== undefined) this.props.model = input.model || undefined;
    if (input.maxRpm !== undefined) this.props.maxRpm = input.maxRpm;
    if (input.maxPowerKw !== undefined) this.props.maxPowerKw = input.maxPowerKw;
    if (input.note !== undefined) this.props.note = input.note || undefined;
  }

  setHourlyRate(hourlyRate: HourlyRate): void {
    this.props.hourlyRate = hourlyRate;
  }

  setStatus(status: MachineStatus): void {
    this.props.status = status;
  }

  assignToCapacityGroup(capacityGroupId: string | undefined): void {
    this.props.capacityGroupId = capacityGroupId;
  }
}
