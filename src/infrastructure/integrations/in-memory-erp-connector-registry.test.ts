import { describe, it, expect } from "vitest";
import { InMemoryErpConnectorRegistry } from "./in-memory-erp-connector-registry";
import { FakeErpConnector } from "./testing/fake-erp-connector";
import { UnknownConnectorTypeError } from "@/domain/errors/unknown-connector-type-error";

describe("ErpConnectorRegistry (InMemoryErpConnectorRegistry)", () => {
  it("umožní zaregistrovat nový typ konektoru bez zásahu do domény - registrace je jen data v paměti", () => {
    const registry = new InMemoryErpConnectorRegistry();
    expect(registry.has("acme-erp")).toBe(false);

    registry.register(new FakeErpConnector("acme-erp"));

    expect(registry.has("acme-erp")).toBe(true);
    expect(registry.get("acme-erp").connectorType).toBe("acme-erp");
  });

  it("podporuje víc nezávislých konektorů současně (helios, sap, custom-rest, ...)", () => {
    const registry = new InMemoryErpConnectorRegistry();
    registry.register(new FakeErpConnector("helios"));
    registry.register(new FakeErpConnector("sap"));
    registry.register(new FakeErpConnector("custom-rest"));

    const list = registry.list();
    expect(list.map((d) => d.connectorType).sort()).toEqual(["custom-rest", "helios", "sap"]);
    for (const descriptor of list) {
      expect(descriptor.capabilities.supportedEntityTypes).toContain("machine");
    }
  });

  it("nedostupný (nezaregistrovaný) konektor vrátí srozumitelnou chybu, ne pád na undefined", () => {
    const registry = new InMemoryErpConnectorRegistry();
    expect(() => registry.get("nikdy-nezaregistrovany")).toThrow(UnknownConnectorTypeError);
    expect(() => registry.get("nikdy-nezaregistrovany")).toThrow(/nikdy-nezaregistrovany/);
  });

  it("descriptor obsahuje capabilities z konkrétní instance konektoru, ne obecný placeholder", () => {
    const registry = new InMemoryErpConnectorRegistry();
    const connector = new FakeErpConnector("with-export", {
      supportsImport: false,
      supportsExport: true,
      supportsSynchronization: true,
      supportsIncrementalSync: false,
      supportsAttachments: true,
      supportedEntityTypes: ["machine", "tool"],
    });
    registry.register(connector);

    const descriptor = registry.list().find((d) => d.connectorType === "with-export");
    expect(descriptor?.capabilities.supportsExport).toBe(true);
    expect(descriptor?.capabilities.supportedEntityTypes).toEqual(["machine", "tool"]);
  });
});
