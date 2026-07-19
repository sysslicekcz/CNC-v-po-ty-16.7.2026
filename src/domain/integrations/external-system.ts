import { ValidationError } from "../errors/validation-error";

export type ExternalSystemType = "erp" | "mes" | "accounting" | "planning" | "custom" | "file_exchange";
export type ExternalSystemStatus = "active" | "inactive";

export interface ExternalSystemProps {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  type: ExternalSystemType;
  /** Otevřený řetězec ("helios", "sap", "k2", "excel", "custom-rest", ...) -
   *  ZÁMĚRNĚ ne uzavřený union. Nový konektor se přidá zápisem nové hodnoty do
   *  ErpConnectorRegistry, nikdy změnou tohohle typu ani domény (viz
   *  docs/adr/erp-agnostic-integration-layer.md). */
  connectorType: string;
  status: ExternalSystemStatus;
}

/**
 * Jeden konkrétní připojený externí systém tenanta (ERP, MES, účetnictví,
 * plánovací nástroj, souborová výměna, ...) - Krok 3.5 dodatek "ERP-nezávislá
 * architektura". Appka nezná napevno žádný konkrétní systém (Helios je jen
 * PŘÍKLAD `connectorType`, ne architektonická závislost). Jeden tenant může
 * mít víc `ExternalSystem` záznamů současně (např. ERP + samostatný MES).
 * Nenahrazuje `Machine`/`Tool`/žádnou jinou lokální entitu - jen popisuje
 * "s jakým vnějším systémem appka komunikuje", vazby na konkrétní lokální
 * záznamy nesou `ExternalReference`.
 */
export class ExternalSystem {
  private constructor(private props: ExternalSystemProps) {}

  static create(props: ExternalSystemProps): ExternalSystem {
    if (!props.tenantId.trim()) throw new ValidationError("ExternalSystem: 'tenantId' nesmí být prázdné.");
    if (!props.code.trim()) throw new ValidationError("ExternalSystem: 'code' nesmí být prázdný.");
    if (!props.name.trim()) throw new ValidationError("ExternalSystem: 'name' nesmí být prázdné.");
    if (!props.connectorType.trim()) throw new ValidationError("ExternalSystem: 'connectorType' nesmí být prázdný.");
    return new ExternalSystem({ ...props });
  }

  static restore(props: ExternalSystemProps): ExternalSystem {
    return new ExternalSystem({ ...props });
  }

  get id(): string {
    return this.props.id;
  }
  get tenantId(): string {
    return this.props.tenantId;
  }
  get code(): string {
    return this.props.code;
  }
  get name(): string {
    return this.props.name;
  }
  get type(): ExternalSystemType {
    return this.props.type;
  }
  get connectorType(): string {
    return this.props.connectorType;
  }
  get status(): ExternalSystemStatus {
    return this.props.status;
  }

  rename(name: string): void {
    if (!name.trim()) throw new ValidationError("ExternalSystem: 'name' nesmí být prázdné.");
    this.props.name = name;
  }

  setStatus(status: ExternalSystemStatus): void {
    this.props.status = status;
  }
}
