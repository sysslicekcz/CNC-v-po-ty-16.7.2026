import {
  ErpConnectorRegistry,
  ErpConnectorDescriptor,
  RegisterableErpConnector,
} from "@/domain/integrations/erp-connector-registry";
import { ErpConnector } from "@/domain/integrations/erp-connector";
import { UnknownConnectorTypeError } from "@/domain/errors/unknown-connector-type-error";

/** Jediná implementace `ErpConnectorRegistry` (Krok 3.5 dodatek, bod 8) - jen
 *  registr v paměti procesu, konektory samy jsou kód, ne data k perzistenci
 *  (na rozdíl od `ExternalSystem`, což JE perzistovaná konfigurace konkrétního
 *  připojení). Appka si při startu zaregistruje, co má k dispozici (v tomhle
 *  kroku jen testovací `FakeErpConnector`) - žádné prázdné implementace pro
 *  konkrétní ERP. */
export class InMemoryErpConnectorRegistry implements ErpConnectorRegistry {
  private readonly connectors = new Map<string, ErpConnector>();

  register(connector: RegisterableErpConnector): void {
    this.connectors.set(connector.connectorType, connector);
  }

  get(connectorType: string): ErpConnector {
    const connector = this.connectors.get(connectorType);
    if (!connector) {
      throw new UnknownConnectorTypeError(connectorType);
    }
    return connector;
  }

  has(connectorType: string): boolean {
    return this.connectors.has(connectorType);
  }

  list(): ErpConnectorDescriptor[] {
    return [...this.connectors.values()].map((connector) => {
      const withMetadata = connector as RegisterableErpConnector;
      return {
        connectorType: connector.connectorType,
        name: withMetadata.name ?? connector.connectorType,
        version: withMetadata.version ?? "0.0.0",
        capabilities: connector.getCapabilities(),
        requiredFeatureCode: withMetadata.requiredFeatureCode,
      };
    });
  }
}
