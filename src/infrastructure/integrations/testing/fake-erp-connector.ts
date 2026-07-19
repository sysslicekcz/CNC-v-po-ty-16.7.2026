import { ErpConnector, ConnectorCapabilities, ErpImportResult } from "@/domain/integrations/erp-connector";

/**
 * TESTOVACÍ konektor (Krok 3.5 dodatek, bod 8: "V tomto kroku postačí
 * testovací FakeErpConnector... nevytvářej prázdné implementace pro SAP,
 * Helios, K2 a další systémy"). Používá se jen v testech `ErpConnectorRegistry`
 * a podobných - NIKDY se nezapojuje do skutečné appky/registrace při startu.
 */
export class FakeErpConnector implements ErpConnector {
  readonly name = "Fake ERP Connector";
  readonly version = "1.0.0-test";

  constructor(
    readonly connectorType: string = "fake",
    private readonly capabilities: ConnectorCapabilities = {
      supportsImport: true,
      supportsExport: false,
      supportsSynchronization: false,
      supportsIncrementalSync: false,
      supportsAttachments: false,
      supportedEntityTypes: ["machine"],
    }
  ) {}

  getCapabilities(): ConnectorCapabilities {
    return this.capabilities;
  }

  async importData(): Promise<ErpImportResult> {
    return {
      createdCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      errorCount: 0,
      issues: [],
    };
  }
}
