# 0007 – SortKey odděleně od OperationNumber

## Status
Přijato

## Context
Zadání vyžaduje, aby vložení operace mezi dvě existující nevyžadovalo přepis pořadí ostatních operací, a zároveň aby operace měly čitelné zobrazovací číslo po desítkách (Op10, Op20, ...). Číselné pořadí (`number`) by se buď muselo přepočítávat při každém vložení, nebo by po čase došly desetinná místa.

## Decision
Dvě nezávislá pole:
- `SortKey` – immutable obálka nad base62 stringem, deterministický fractional-indexing algoritmus (`initial()`, `between()`, `after()`, `before()`). Řídí skutečné pořadí. Vložení mezi dva sousedy vygeneruje klíč mezi nimi, ostatní záznamy se nepřepisují.
- `OperationNumber` – čistě zobrazovací celé číslo (`create()`, `next()`), nezávislé na `SortKey`. Přečíslování (`RoutingSheet.renumberOperations()`) mění jen tohle pole, nikdy `SortKey`.

## Consequences
- Drag & drop / vložení mezi dvě operace je O(1) operace na jeden záznam.
- Dvě pole místo jednoho – vyžaduje disciplínu, aby se nezaměnila (test `OperationNumber nezávislé na SortKey` to ověřuje).
