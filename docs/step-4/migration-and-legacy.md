# Migrace a legacy appka v Kroku 4

## Legacy appka zůstává nedotčená

`src/app/page.tsx`, `src/components`, `src/lib`, stará IndexedDB databáze `cnc-casovac` - žádný soubor nebyl v Kroku 4 změněný ani smazaný (strangler pattern, potvrzeno auditem). Legacy appka slouží i jako zdroj dat pro `/dev/tpv-migration` nástroj a jako zdroj konfigurace kalkulačního enginu (`src/lib/operations.ts`) - to jsou jediné dva body dotyku.

## `tpv-db.ts` DB verze 3 → 4

Krok 4 přidal:
- indexy `tenantId`, `tenantId_partId` na existující store `tpvRoutingSheets` (dřív netenant-scoped),
- nový store `tpvReleasedRoutingSheetSnapshots` (keyPath `routingSheetId`, indexy `tenantId`, `partId`).

Upgrade blok (`if (oldVersion < 4)`) je čistě aditivní - žádná destruktivní migrace, existující data zůstávají.

## Oprava: `migrate-routing-data.ts` už nepřepisuje existující postupy

**Před Krokem 4** (respektive před opravou v tomto kroku): `runMigrateRoutingDataPhase` používala deterministické ID (`deterministicId("routing-sheet", legacyPartId)`) a při KAŽDÉM běhu migrace bezpodmínečně přepsala RoutingSheet daného dílu čerstvým draftem revize 1 - i kdyby mezitím technolog postup vydal, vytvořil další revize, nebo ho archivoval. To je destruktivní chování v přímém rozporu se standardní zásadou appky ("žádné destruktivní migrace") a Krok 4 ho poprvé zpřístupnil jako reálné riziko (dřív RoutingSheet žádný netriviální post-migrační životní cyklus neměla, takže na tom nezáleželo).

**Oprava (tento krok):** `runMigrateRoutingDataPhase` před zpracováním dílu ověří, jestli pro něj RoutingSheet se stejným deterministickým ID už existuje (`routingSheetRepository.findById`). Pokud ano, díl PŘESKOČÍ - nepřepíše nic, přidá `info` issue (`routing-sheet-already-migrated`) a `skipped.routingSheets` čítač. Díky tomu:
- opakovaný běh migrace (typicky po přidání nových legacy dílů) NIKDY nezahodí revizní historii/vydání/archivaci, které mezitím vznikly v editoru,
- `post-validation.ts` automaticky přeskočené díly nepočítá do kontroly shody s legacy zdrojem (nejsou v `routingSheetIdMap`) - nehlásí falešné neshody pro postup, který se od migrace legitimně změnil v editoru.

Ověřeno testem `"opakované spuštění NEPŘEPÍŠE už rozpracovanou RoutingSheet"` v `migration-runner.test.ts`.

## `DEFAULT_TENANT_ID`

Migrace (`migrate-routing-data.ts`) zapisuje nové `RoutingSheet` vždy s `tenantId: DEFAULT_TENANT_ID` (Krok 3.5 konvence) - `post-validation.ts` a `rollback.ts` byly upravené, aby volaly nově tenant-scoped repository metody (`listByPartId(tenantId, partId)`, `delete(id, tenantId)`) se stejnou konstantou.
