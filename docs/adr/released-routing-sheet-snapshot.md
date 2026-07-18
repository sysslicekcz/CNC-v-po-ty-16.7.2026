# Denormalizovaný snapshot vydaného postupu

## Status
Přijato (Krok 4 - Editor technologického postupu)

## Context
Živá `RoutingSheet` (i vydaná) pořád ukazuje na AKTUÁLNÍ `Machine`/`Tool`/`OperationType` přes `machineId`/`toolId`/`operationTypeId`. Pokud se stroj později přejmenuje, deaktivuje nebo smaže, historický vydaný postup by při zobrazení najednou ukazoval jiná/chybějící data, než jaká platila v okamžiku vydání - to je nepřijatelné pro dokument, který slouží jako výrobní reference a musí zůstat čitelný přesně tak, jak vypadal v den vydání.

## Decision
Při vydání (`ReleaseRoutingSheetUseCase`) se vedle mutace živého agregátu vytvoří samostatný, plně denormalizovaný `ReleasedRoutingSheetSnapshot` (`buildReleasedRoutingSheetSnapshot`) - obsahuje kód i název stroje/nástroje/typu operace ZAMRZLÉ v okamžiku vydání, ne odkazy (`machineId`), ale hodnoty (`machineCode`, `machineName`).

Snapshot se ukládá do VLASTNÍHO IndexedDB store (`tpvReleasedRoutingSheetSnapshots`), odděleně od `RoutingSheet` - žádná společná tabulka, žádný "verzovaný" řádek. Repository (`ReleasedRoutingSheetSnapshotRepository`) má jen `findByRoutingSheetId`/`listByPartId`/`save` - ŽÁDNÉ `update`/`delete`. Immutabilita je tedy vynucená i na úrovni rozhraní, ne jen konvencí.

Živá `RoutingSheet` si i po vydání PONECHÁVÁ odkazy na aktuální `Machine`/`Tool` (ne na snapshot hodnoty) - to je záměrné: `RoutingSheet` je dál "živý" záznam použitelný jako základ pro novou revizi (viz `docs/adr/new-revision-instead-of-editing-release.md`), zatímco snapshot je čistě READ-ONLY historický pohled pro zobrazení/tisk vydaného dokumentu.

## Consequences
- Snapshot je navržený tak, aby zobrazení vydaného postupu čerpalo VÝHRADNĚ z něj (`GetReleasedRoutingSheetUseCase`) - nikdy by znovu nemělo dotahovat `Machine`/`Tool` podle id, takže pozdější přejmenování/smazání číselníkové položky by historický dokument nezměnilo.
- **Známá mezera (viz `docs/step-4/known-limitations.md`):** `GetReleasedRoutingSheetUseCase` existuje a je otestovaný, ale editor (`/tpv/routing-sheets/[id]`) ho v tomto kroku NEPOUŽÍVÁ - read-only zobrazení vydaného postupu dnes čte živou `RoutingSheet` (přes stejný `load()` jako draft), ne snapshot. Snapshot se korektně VYTVÁŘÍ při vydání a je čitelný přes use case, jen ještě není zapojený do žádné obrazovky. Riziko je omezené (živá `RoutingSheet` je needitovatelná po vydání, takže dokud se stroj/nástroj nepřejmenuje, zobrazuje stejná data jako snapshot), ale neplatí to už při přejmenování číselníkové položky - do té doby je tohle zapojení prioritou pro Krok 5.
- Duplicitní uložení dat (stejný název stroje existuje jednou v `Machine`, jednou zamrzlý ve snapshotu) je vědomý kompromis - řeší přesně problém "historický dokument musí zůstat čitelný", který normalizace neumí.
- `ActivityRecord`/persistence typy pro snapshot NEMAJÍ vlastní mapper (`ReleasedRoutingSheetSnapshotRecord` je jen type alias na doménový typ) - žádné Value Objecty ani chování k mapování, jen zamrzlá čitelná data.
