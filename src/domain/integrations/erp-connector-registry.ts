import { ErpConnector, ConnectorCapabilities } from "./erp-connector";

export interface ErpConnectorDescriptor {
  connectorType: string;
  name: string;
  version: string;
  capabilities: ConnectorCapabilities;
  /** Volitelný `ConnectorFeatureCode` (`"connector.helios"` apod.), který
   *  licence musí povolovat, aby šel tenhle konektor použít - viz
   *  `FeatureAccessService`/`docs/adr/erp-agnostic-integration-layer.md`. */
  requiredFeatureCode?: string;
}

/** Popisné metadata konektoru nad rámec `ErpConnector` samotného
 *  (`name`/`version`/`requiredFeatureCode`) - konektor je nese jako obyčejné
 *  (nepovinné) vlastnosti navíc, `register()` je z instance přečte. Konektor
 *  bez nich zůstává platným `ErpConnector` - `ErpConnectorDescriptor` pak jen
 *  doplní rozumné výchozí hodnoty (`connectorType` jako `name`, `"0.0.0"` jako
 *  `version`). */
export type RegisterableErpConnector = ErpConnector & Partial<Omit<ErpConnectorDescriptor, "connectorType" | "capabilities">>;

/**
 * Rozšiřitelný registr konektorů (Krok 3.5 dodatek, bod 8) - přidání nového
 * konektoru (SAP, K2, vlastní REST API, ...) znamená jen zavolat `register()`
 * při startu appky, NIKDY zásah do domény ani do tohohle rozhraní.
 */
export interface ErpConnectorRegistry {
  register(connector: RegisterableErpConnector): void;
  get(connectorType: string): ErpConnector;
  has(connectorType: string): boolean;
  list(): ErpConnectorDescriptor[];
}
