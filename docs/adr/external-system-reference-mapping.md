# Mapování na externí systémy přes ExternalReference, ne vestavěná pole

## Status
Přijato (dodatek ke Kroku 3.5)

## Context
Lokální entity appky (`Machine`, `Tool`, `Customer`, `Operation`, ...) potřebují jít napárovat na záznamy v externích systémech (ERP, MES, účetnictví, ...). Naivní řešení - přidat pole typu `heliosId`/`sapCode` přímo na doménové entity - by appku architektonicky svázalo s konkrétním počtem a typem podporovaných systémů a nedovolilo by jedné entitě mít víc nezávislých vazeb současně (např. Machine napojený na ERP i na samostatný MES).

## Decision
Vazba lokální entity na externí systém je samostatná entita `ExternalReference` (`src/domain/integrations/external-reference.ts`), NE pole na `Machine`/`Tool`/atd.:

```typescript
interface ExternalReference {
  id: string;
  tenantId: string;
  externalSystemId: string;
  localEntityType: ExternalReferenceEntityType; // "machine" | "tool" | ...
  localEntityId: string;                        // Machine.id, ne Machine.code
  externalEntityType: string;                   // otevřený - jak entitu nazývá SÁM externí systém
  externalId?: string;
  externalCode?: string;
  createdAt: string;
  updatedAt: string;
}
```

Klíčové vlastnosti modelu:
- **Jedna lokální entita, víc referencí.** `Machine.id` může mít `ExternalReference` A (vazba na Helios), B (vazba na MES), C (vazba na jiný ERP) současně - žádná z nich nenahrazuje interní `id` ani `Machine.code` (podnikový kód, viz `docs/adr/0015`).
- **`externalId` není globálně unikátní.** Unikátnost se posuzuje jen v rámci `[externalSystemId, externalEntityType, externalId]` (unikátní IndexedDB index `tpvExternalReferences.externalSystemId_externalEntityType_externalId`) - stejná hodnota smí nezávisle existovat ve dvou různých systémech (dva různé ERP mohou používat shodné číslování).
- **Tři oddělené koncepty.** Interní `id` (appka), podnikový `code`/business kód (uživatel/zákazník), externí reference (konkrétní ERP záznam) - žádný z nich nenahrazuje druhý.
- **`ExternalEntityResolver`** (`src/domain/integrations/external-entity-resolver.ts`, implementace `DefaultExternalEntityResolver`) je jediné místo, které "najde lokální entitu podle externího záznamu" - hledá nejdřív přes existující `ExternalReference`, pak volitelně přes podnikový kód (`businessCode`, injektovaná strategie per `localEntityType`). NIKDY sám nezaloží novou lokální entitu.

## Consequences
- Odpojení/smazání jednoho `ExternalSystem` neovlivní data v jiném - reference jsou na sobě nezávislé.
- Historické `CalculationSnapshot` (viz `docs/adr/0006`) se `ExternalReference` netýká - snapshoty zachycují lokální identitu/cenu v okamžiku výpočtu, ne stav napárování na ERP.
- Budoucí import/export/sync (mimo rozsah tohoto kroku) bude vždy procházet přes `ExternalEntityResolver`, ne přes ad-hoc porovnávání řetězců rozeseté po use casech.
