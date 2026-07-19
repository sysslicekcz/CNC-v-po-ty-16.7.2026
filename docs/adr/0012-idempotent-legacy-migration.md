# 0012 – Idempotence přes deterministická id + IndexedDB `put()`

## Status
Přijato

## Context
Migrace musí být bezpečně opakovatelná - druhé spuštění nesmí vytvořit duplicitní zákazníky, výchozí postupy, capability ani seed číselníky.

## Decision
Každý migrovaný záznam dostane deterministické id `tpv-{typ}:{legacyId}` (`infrastructure/migration/id-mapping.ts`). Zápis vždy probíhá přes IndexedDB `put()` (upsert), nikdy `add()`. Díky tomu druhé spuštění nad stejnými legacy daty zapíše přesně stejné id se stejným obsahem - žádná duplicita nemůže vzniknout, aniž by bylo nutné před každým zápisem kontrolovat existenci. Legacy id/zdroj/`migrationRunId` se navíc ukládají jako perzistenční metadata (`LegacyStamp`), takže je zpětně dohledatelné, co vzniklo odkud a z jakého běhu.

Přerušený běh (status zůstal `"running"`/`"pending"` po pádu appky) se při dalším spuštění neignoruje slepě - označí se jako `"failed"` a spustí se nový běh; díky idempotenci je to bezpečné, nový běh jen znovu zapíše (přepíše) stejná id.

## Consequences
- Žádná složitá "existuje/neexistuje" logika v migračních fázích - jednodušší kód.
- Cena: pokud se legacy id samo změní (v praxi se nemění, appka je negeneruje znovu), migrace by vytvořila nový, ne aktualizovaný záznam - akceptovatelné riziko.
