import { IntegrationDirection, IntegrationMode } from "./integration-run";
import { IntegrationIssue } from "./integration-issue";

export interface ConnectorCapabilities {
  supportsImport: boolean;
  supportsExport: boolean;
  supportsSynchronization: boolean;
  supportsIncrementalSync: boolean;
  supportsAttachments: boolean;
  /** Otevřený seznam `ExternalReferenceEntityType`-like řetězců, které tenhle
   *  konektor umí importovat/exportovat/synchronizovat. */
  supportedEntityTypes: string[];
}

/** Opaque nastavení konkrétního připojení - obsah je čistě věcí konektoru
 *  (`connectorType` říká, jak ho interpretovat). Doména/application vrstva do
 *  `settings` nikdy nenahlíží ani podle něj nerozhoduje. */
export interface ExternalSystemConfiguration {
  externalSystemId: string;
  connectorType: string;
  settings: Record<string, unknown>;
}

export type ConnectionTestResult = { status: "ok" } | { status: "error"; message: string };

export interface ErpImportRequest {
  tenantId: string;
  externalSystemId: string;
  integrationRunId: string;
  /** Nepovinné zúžení na konkrétní typy entit - bez zadání konektor importuje
   *  vše, co `getCapabilities().supportedEntityTypes` uvádí. */
  entityTypes?: string[];
}

export interface ErpImportResult {
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  errorCount: number;
  issues: IntegrationIssue[];
}

export interface ErpExportRequest {
  tenantId: string;
  externalSystemId: string;
  integrationRunId: string;
  entityTypes?: string[];
}

export interface ErpExportResult {
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  errorCount: number;
  issues: IntegrationIssue[];
}

export interface ErpSynchronizationRequest {
  tenantId: string;
  externalSystemId: string;
  integrationRunId: string;
  direction: IntegrationDirection;
  mode: IntegrationMode;
  /** Nastaví konektor s `supportsIncrementalSync: true` na dřívější úspěšný
   *  běh - konektor bez inkrementální podpory hodnotu ignoruje. */
  sinceIntegrationRunId?: string;
}

export interface ErpSynchronizationResult {
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  errorCount: number;
  issues: IntegrationIssue[];
}

/**
 * Obecné integrační DTO pro anti-corruption hranici mezi konkrétním
 * konektorem a zbytkem appky (Krok 3.5 dodatek, bod 9) - konkrétní ERP DTO
 * (např. budoucí `HeliosWorkplaceDto`) smí existovat JEN uvnitř svého
 * konektoru (`infrastructure/integrations/<connectorType>/`); do application
 * use casu/domény smí projít jen tenhle obecný tvar. `sourceMetadata` je
 * volně strukturovaný "zbytek", co appka zatím neumí zpracovat - NIKDY nesmí
 * řídit doménovou logiku (žádné `if (sourceMetadata.heliosFlag)` kdekoliv
 * mimo konektor samotný).
 */
export interface ExternalMachineData {
  externalId?: string;
  externalCode?: string;
  businessCode?: string;
  name: string;
  designation?: string;
  sourceMetadata?: Record<string, unknown>;
}

/**
 * Kontrakt jednoho konektoru na konkrétní typ externího systému (Krok 3.5
 * dodatek, bod 7) - JEN kontrakt, appka si sama neimplementuje žádný
 * konkrétní ERP (Helios, SAP, K2, ...) v tomhle kroku. `connectorType` je
 * stabilní identifikátor ("helios", "sap", "custom-rest", ...), podle kterého
 * se konektor zaregistruje do `ErpConnectorRegistry` a podle kterého
 * `ExternalSystem.connectorType`/`License` odkazují na tenhle konektor.
 *
 * Ne každý konektor musí implementovat všechny operace - proto jsou
 * `testConnection`/`importData`/`exportData`/`synchronize` volitelné;
 * `getCapabilities()` říká volajícímu, co konektor skutečně podporuje, PŘED
 * tím, než se o nepodporovanou operaci pokusí.
 */
export interface ErpConnector {
  readonly connectorType: string;

  getCapabilities(): ConnectorCapabilities;

  testConnection?(configuration: ExternalSystemConfiguration): Promise<ConnectionTestResult>;

  importData?(request: ErpImportRequest): Promise<ErpImportResult>;

  exportData?(request: ErpExportRequest): Promise<ErpExportResult>;

  synchronize?(request: ErpSynchronizationRequest): Promise<ErpSynchronizationResult>;
}
