# Snapshot vydaného postupu

Architektonické zdůvodnění: `docs/adr/released-routing-sheet-snapshot.md`. Tenhle dokument popisuje konkrétní tvar a tok dat.

## Kdy vzniká

`ReleaseRoutingSheetUseCase` v jednom běhu: validuje (viz `docs/step-4/validation.md`), zavolá `routingSheet.release()`, sestaví `ReleasedRoutingSheetSnapshot` (`buildReleasedRoutingSheetSnapshot`), uloží OBOJE (živou `RoutingSheet` i snapshot) - žádná částečná mutace při chybě validace (validace proběhne PŘED jakýmkoliv zápisem).

## Tvar

`ReleasedRoutingSheetSnapshot` je plně denormalizovaný strom (`ReleasedRoutingOperationSnapshot` → `ReleasedOperationPositionSnapshot` → `ReleasedOperationActivitySnapshot`) - kód i název stroje/nástroje/typu operace jsou ZAMRZLÉ hodnoty, ne odkazy. `schemaVersion` pole (`RELEASED_ROUTING_SHEET_SNAPSHOT_SCHEMA_VERSION = 1`) je připravené pro budoucí migraci tvaru snapshotu, kdyby se struktura změnila.

## Persistence

Vlastní IndexedDB store `tpvReleasedRoutingSheetSnapshots` (DB verze 4), oddělený od `tpvRoutingSheets`. Repository (`ReleasedRoutingSheetSnapshotRepository`) má jen `findByRoutingSheetId`/`listByPartId`/`save` - ŽÁDNÉ update/delete, immutabilita je tedy vynucená rozhraním.

## Známá mezera: snapshot není zapojený do zobrazení

`GetReleasedRoutingSheetUseCase` existuje a je otestovaný (čte snapshot, kontroluje `routing.view` licenci), ALE editor (`/tpv/routing-sheets/[id]`) ho v tomto kroku NEPOUŽÍVÁ pro zobrazení vydaného postupu - read-only pohled dnes čte živou `RoutingSheet` stejnou cestou jako draft (`load()` v `useRoutingSheetEditor`). Riziko je dnes nízké (živá `RoutingSheet` je po vydání needitovatelná, takže dokud se navázaný stroj/nástroj nepřejmenuje, ukazuje stejná data jako snapshot), ale přesně tenhle scénář (přejmenování stroje PO vydání) je důvod, proč snapshot vůbec existuje - zapojení do UI je otevřená priorita pro Krok 5 (viz `docs/step-4/step-5-readiness.md`).
