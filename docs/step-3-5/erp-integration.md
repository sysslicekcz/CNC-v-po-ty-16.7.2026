# ERP-neutrální integrační vrstva

Dodatek ke Kroku 3.5 - "OPRAVA NA ERP-NEZÁVISLOU ARCHITEKTURU". Viz `docs/adr/erp-agnostic-integration-layer.md`, `docs/adr/external-system-reference-mapping.md` a `docs/adr/anti-corruption-layer-for-erp-connectors.md` pro rozhodnutí. Tenhle dokument je praktický přehled.

## Proč tenhle dodatek vznikl

Původní implementace Kroku 3.5 zavedla licenční funkce `integration.helios.*` a v dokumentaci appku rámovala jako "připravenou na Helios integraci". To je architektonická chyba - appka nesmí být závislá na jednom konkrétním ERP. Zákazníci reálně používají SAP, K2, ABRA, Pohodu, Money ERP, Microsoft Dynamics, Infor, Odoo, vlastní ERP, REST/SOAP API, Excel/CSV výměnu nebo databázové pohledy. **TPV funguje bez připojeného ERP. Helios je pouze jeden z možných konektorů.**

## Tři oddělené koncepty

| Koncept | Co to je | Příklad |
|---|---|---|
| Interní id | Stabilní identita appky, appka ji generuje a nikdy nemění | `Machine.id = "a1b2c3..."` |
| Podnikový kód | Uživatelem zadané označení, appka ho zobrazuje a hlídá unikátnost v rámci tenanta | `Machine.code = "300-58140"` |
| Externí reference | Vazba na záznam v KONKRÉTNÍM externím systému, jedna lokální entita jich může mít víc | `ExternalReference { externalSystemId: "sys-helios", externalId: "WP-42" }` |

Žádný z těchto tří konceptů nenahrazuje jiný - viz `docs/adr/external-system-reference-mapping.md`.

## ExternalSystem

`src/domain/integrations/external-system.ts` - jeden konkrétně připojený externí systém tenanta. `connectorType: string` je ZÁMĚRNĚ otevřený řetězec (`"helios"`, `"sap"`, `"k2"`, `"excel"`, `"custom-rest"`, ...), ne uzavřený union - přidání nového konektoru nikdy nevyžaduje změnu domény. Jeden tenant může mít víc `ExternalSystem` současně (ERP + samostatný MES).

## ExternalReference

`src/domain/integrations/external-reference.ts` - váže JEDNU lokální entitu (`localEntityType` + `localEntityId`, např. `"machine"` + `Machine.id`) na záznam v JEDNOM `ExternalSystem`. Jedna lokální entita může mít reference ve víc systémech současně. Unikátnost `externalId` se posuzuje jen v rámci `[externalSystemId, externalEntityType, externalId]` (unikátní IndexedDB index) - **stejná hodnota smí nezávisle existovat ve dvou různých systémech** (dva ERP mohou používat shodné číslování, aniž by si "překážely").

## ExternalEntityResolver

`src/domain/integrations/external-entity-resolver.ts` (implementace `DefaultExternalEntityResolver`, `src/application/integrations/`) - najde lokální entitu odpovídající externímu záznamu: nejdřív podle existující `ExternalReference` (`externalId`), pak volitelně podle podnikového kódu (`businessCode`, injektovaná strategie per `localEntityType`). Výsledek je vždy jeden ze čtyř stavů (`matched`/`not_found`/`ambiguous`/`conflict`) - resolver **nikdy sám nezaloží novou lokální entitu**, založení/spárování je vždy explicitní rozhodnutí importní politiky (mimo rozsah tohoto kroku).

## ErpConnector a ErpConnectorRegistry

`src/domain/integrations/erp-connector.ts` je jen KONTRAKT - `getCapabilities()` + volitelné `testConnection`/`importData`/`exportData`/`synchronize`. Ne každý konektor musí implementovat všechny operace. `src/domain/integrations/erp-connector-registry.ts` definuje rozšiřitelný registr (`register`/`get`/`has`/`list`), implementace `InMemoryErpConnectorRegistry` (`src/infrastructure/integrations/`). Přidání nového konektoru = napsat implementaci `ErpConnector` a zavolat `register()`, beze změny domény.

**V tomhle kroku appka neobsahuje žádnou reálnou implementaci konkrétního ERP** - jen testovací `FakeErpConnector` (`src/infrastructure/integrations/testing/fake-erp-connector.ts`), který se nikdy nezapojuje do provozu appky. Žádné prázdné implementace pro SAP/Helios/K2.

## Anti-corruption layer

```
konkrétní ERP DTO (např. budoucí HeliosWorkplaceDto)
        ↓  jen uvnitř infrastructure/integrations/<connectorType>/
konkrétní ERP adaptér (implementuje ErpConnector)
        ↓
obecné integrační DTO (ExternalMachineData)
        ↓
application use case
        ↓
TPV doména (Machine, Operation, ...)
```

`ExternalMachineData.sourceMetadata: Record<string, unknown>` je únikový ventil pro pole, která appka zatím neumí zpracovat - **nikdy nesmí řídit doménovou logiku**. Viz `docs/adr/anti-corruption-layer-for-erp-connectors.md`.

## IntegrationRun a IntegrationIssue

`src/domain/integrations/integration-run.ts`/`integration-issue.ts` - ERP-neutrální obdoba `MigrationRunRecord`/`MigrationIssueRecord` (Krok 3), ale pro OPAKOVANÉ běhy proti externímu systému (import/export/sync), ne jednorázovou migraci legacy dat. Persistence (`tpvIntegrationRuns`, `tpvIntegrationIssues`) je hotová a otestovaná, ale žádný use case je zatím reálně nezapisuje - viz `docs/step-3-5/known-limitations.md`.

## Licence integrací

`FeatureCode` obsahuje jen obecné `integration.erp.view/configure/import/export/sync/multiple_systems` a `integration.file.import/export` - žádné `integration.helios.*`. Dostupnost KONKRÉTNÍHO konektoru řídí dynamický `ConnectorFeatureCode` (`connector.helios`, `connector.sap`, ...) - viz `docs/step-3-5/licensing.md`, sekce "Licence jednotlivých konektorů".

## IndexedDB schema

`tpv-db.ts`, `DB_VERSION` 2 → 3 (aditivní): `tpvExternalSystems`, `tpvExternalReferences`, `tpvIntegrationRuns`, `tpvIntegrationIssues`. `tpvExternalSystemConfigurations` záměrně NENÍ přidané - žádná reálná konfigurace konektoru v tomhle kroku nevzniká (spec bod 12).

## Testy

`src/architecture-tests/erp-neutrality.test.ts` (statické kontroly - žádný Helios import/export v domain/application, `Machine`/`Operation` bez ERP-specifických polí), `external-reference-repository.test.ts` (víc referencí na jednu entitu, stejné externalId ve dvou systémech, konflikt ve stejném systému), `in-memory-erp-connector-registry.test.ts` (registrace nového konektoru, neznámý konektor vrátí čitelnou chybu), `default-external-entity-resolver.test.ts`, `connector-license-decoupling.test.ts` (odebrání licence konektoru nemaže data).
