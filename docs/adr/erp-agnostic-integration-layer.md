# ERP-nezávislá integrační architektura

## Status
Přijato (dodatek ke Kroku 3.5 - "OPRAVA NA ERP-NEZÁVISLOU ARCHITEKTURU", nahrazuje dřívější Helios-specifické formulace v `docs/adr/0016` a `docs/step-3-5/*`)

## Context
Původní implementace Kroku 3.5 zavedla licenční funkce `integration.helios.import/export/sync/configuration` a v dokumentaci/komentářích rámovala integrační přípravu jako "připravenost na Helios". To je architektonická chyba - appka nesmí být závislá na jednom konkrétním ERP. Zákazníci reálně používají SAP, K2, ABRA, Pohodu, Money ERP, Microsoft Dynamics, Infor, Odoo, vlastní ERP, REST/SOAP API, Excel/CSV výměnu nebo databázové pohledy. Helios je jen JEDEN z možných budoucích konektorů, ne cílová architektura.

## Decision
**TPV doména není závislá na konkrétním ERP. Každý ERP systém je připojen prostřednictvím samostatného adaptéru.**

Konkrétně:
- Doménová a Application vrstva NESMÍ importovat moduly, DTO ani typy konkrétního ERP (žádné `HeliosWorkplaceDto`, `HeliosMachineResolver` apod. mimo konkrétní budoucí Helios adaptér).
- Licenční katalog (`FeatureCode`) obsahuje jen obecné `integration.erp.*`/`integration.file.*` funkce (`view`, `configure`, `import`, `export`, `sync`, `multiple_systems`) - žádné `integration.helios.*`. Dostupnost KONKRÉTNÍHO konektoru řídí dynamický `ConnectorFeatureCode` (`connector.helios`, `connector.sap`, ...), viz `src/domain/licensing/feature-code.ts`.
- Obecný model `ExternalSystem` (`src/domain/integrations/external-system.ts`) - `connectorType: string` je ZÁMĚRNĚ otevřený řetězec, ne uzavřený union. Přidání nového konektoru nikdy nevyžaduje změnu domény.
- Obecný model `ExternalReference` (`src/domain/integrations/external-reference.ts`) váže lokální entitu na záznam v libovolném externím systému - jedna lokální entita může mít reference ve víc externích systémech současně.
- `ErpConnector`/`ErpConnectorRegistry` (`src/domain/integrations/erp-connector*.ts`) jsou jen KONTRAKTY - appka v tomhle kroku implementuje jediný `FakeErpConnector` (testovací), žádné prázdné implementace pro SAP/Helios/K2.
- Konkrétní budoucí Helios adaptér (a jakýkoliv jiný konektor) smí obsahovat Helios-specifické (resp. SAP-specifické, ...) typy a názvy JEN uvnitř svého vlastního adresáře (`infrastructure/integrations/<connectorType>/`), nikdy ve sdílených vrstvách - viz `docs/adr/anti-corruption-layer-for-erp-connectors.md`.

## Consequences
- Přidání nového ERP (SAP, K2, vlastní REST API, Excel/CSV, ...) znamená napsat nový konektor implementující `ErpConnector` a zaregistrovat ho do `ErpConnectorRegistry` - beze změny `Machine`, `Operation`, `RoutingSheet` ani žádné jiné doménové entity.
- Změna nebo výměna ERP systému nerozbije interní vazby (`Operation.machineId -> Machine.id`) ani technologické postupy - ty na `ExternalSystem`/`ExternalReference` vůbec nezávisí.
- TPV appka funguje i BEZ jakéhokoliv připojeného ERP - `ExternalSystem`/`ExternalReference` jsou čistě volitelná rozšíření, ne povinná závislost.
- Licence integrací je obecná (`integration.erp.*`) a nezávisle řídí konkrétní konektory (`connector.*`) - odebrání licence jednoho konektoru nemaže data importovaná dřív (viz test `connector-license-decoupling.test.ts`).
