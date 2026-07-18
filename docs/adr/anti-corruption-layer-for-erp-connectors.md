# Anti-corruption layer pro ERP konektory

## Status
Přijato (dodatek ke Kroku 3.5)

## Context
Bez jasné hranice by konkrétní ERP tvary dat (např. budoucí `HeliosWorkplaceDto` s poli přesně podle Heliosova API) mohly prosakovat až do TPV domény - každá změna Heliosova API by pak vyžadovala zásah do doménových entit, a přidání druhého ERP (SAP) by znamenalo doménu větvit podle zdroje dat.

## Decision
Zavádí se explicitní anti-corruption layer mezi konkrétním konektorem a zbytkem appky. Závazný tok dat:

```
konkrétní ERP DTO (např. HeliosWorkplaceDto)
        ↓  (jen uvnitř infrastructure/integrations/<connectorType>/)
konkrétní ERP adaptér (implementuje ErpConnector)
        ↓
obecné integrační DTO (např. ExternalMachineData)
        ↓
application use case
        ↓
TPV doména (Machine, Operation, ...)
```

Pravidla:
- Konkrétní ERP DTO (`HeliosWorkplaceDto` a obdobné) smí existovat VÝHRADNĚ uvnitř adresáře konkrétního konektoru (`infrastructure/integrations/helios/`) - nikdy v `domain/`, `application/` ani jako parametr sdíleného rozhraní.
- Sdílená vrstva (`domain/integrations/erp-connector.ts`) definuje obecné DTO jako `ExternalMachineData` (`externalId?`, `externalCode?`, `businessCode?`, `name`, `designation?`, `sourceMetadata?`) - konektor je zodpovědný za převod svého konkrétního tvaru dat na tenhle obecný tvar (nebo obdobný per typ entity).
- `sourceMetadata: Record<string, unknown>` je únikový ventil pro pole, která appka zatím neumí zpracovat - je čistě informativní a **NIKDY nesmí řídit doménovou logiku** (žádné `if (sourceMetadata.heliosFlag)` mimo konektor samotný).
- `ErpConnector` (`src/domain/integrations/erp-connector.ts`) je jediný kontrakt, přes který application vrstva s konektory komunikuje - `getCapabilities()`, volitelné `testConnection`/`importData`/`exportData`/`synchronize`. Ne každý konektor musí implementovat všechny operace (např. konektor jen pro export nemusí mít `importData`).
- `ErpConnectorRegistry` (`src/infrastructure/integrations/in-memory-erp-connector-registry.ts`) drží zaregistrované konektory podle `connectorType` - `get()` na nezaregistrovaný typ vyhodí srozumitelnou `UnknownConnectorTypeError`, nikdy nevrátí `undefined` ani nepadne na nedefinované metodě.
- V tomhle kroku appka neobsahuje ŽÁDNOU konkrétní implementaci reálného ERP konektoru (žádný Helios, SAP, K2 adaptér) - jen kontrakt a testovací `FakeErpConnector` (`src/infrastructure/integrations/testing/fake-erp-connector.ts`), který se nikdy nezapojuje do běžícího provozu appky.

## Consequences
- Změna Heliosova (nebo jiného ERP) API se projeví jen uvnitř jeho konektoru - `ExternalMachineData`, use casy i doména zůstávají nedotčené.
- Přidání druhého konektoru (SAP) nevyžaduje, aby doména/application věděla o existenci dvou různých tvarů dat - obě konvertují na stejné obecné DTO.
- Cena: každý konektor musí sám napsat převodní logiku (mapper) ze svého konkrétního tvaru na obecné DTO - to je přijatelné, protože je to přesně práce, kterou by jinak appka musela dělat rozptýleně po doméně.
