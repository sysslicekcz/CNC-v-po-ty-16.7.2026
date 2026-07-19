# Krok 5 – typy nástrojů

Stejná transformace jako u `OperationType` (viz `docs/step-5/operation-types.md`) - `ToolType` (`domain/entities/tool-type.ts`) z globálního seedovaného číselníku na tenant-scoped editovatelná data (`tenantId` přidané, backfill v migraci DB v4→v5).

## Nová pole

- `category: ToolCategory` - otevřený, ale předdefinovaný seznam (soustružnický držák, destička, fréza, vrták, závitník, výstružník, brusný kotouč, měřidlo, jiné). "Jiné" pokrývá vše neznámé - kategorie je jen klasifikační štítek, tenant si vlastní kategorie NEZAKLÁDÁ jako samostatná data (na rozdíl od `OperationType`, kde je celá entita datovým číselníkem).
- `parameterDefinitions: ToolParameterDefinition[]` - definice dynamických parametrů, které smí/musí mít `Tool` tohoto typu: `key` (stabilní programový identifikátor), `name` (čitelný popisek), `valueType` (`number|text|boolean|selection`), `unit?`, `required: boolean`, `allowedValues?` (pro `selection`). Validace duplicitního `key` probíhá v `ToolType.create()`/`updateDetails()` (entita sama, ne use case).

`ToolType` typovou definici jen NESE - validaci konkrétních hodnot na `Tool.parameters` proti ní dělá `application/tools/validate-tool-parameters.ts` (viz `docs/step-5/tools.md`).

## Application use casy

`application/tools/`: `create-tool-type-use-case.ts`, `update-tool-type-use-case.ts`, `deactivate-tool-type-use-case.ts`, `list-tool-types-use-case.ts`. Bez reaktivace jako samostatného use casu (deaktivace typu nástroje zabrání JEN novým nástrojům tohoto typu - existující nástroje zůstávají funkční, viz `MasterDataInactiveError` v `docs/step-5/deactivation-and-history.md`).

## UI

Rozbalitelná sekce na stránce `/tpv/master-data/tools` - formulář s dynamickým editorem `parameterDefinitions` (přidat/odebrat řádek parametru, nastavit klíč/název/typ/jednotku/povinnost/povolené hodnoty).
