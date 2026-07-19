# 0014 – Žádný dual-write mezi starým a novým modelem

## Status
Přijato

## Context
Po dokončení migrace by šlo appku přepnout tak, aby zapisovala současně do staré (`cnc-casovac`) i nové (`cnc-tpv`) databáze, aby oba modely zůstaly synchronní.

## Decision
V tomto kroku se dual-write neimplementuje. Migrace je jednorázové (opakovatelné, idempotentní) kopírování legacy dat do nového modelu, ne průběžná synchronizace. Staré UI dál čte a zapisuje výhradně do staré databáze; nová databáze se plní jen migrací.

## Consequences
- Po migraci může nová databáze zaostat za změnami provedenými ve staré appce (uživatel dál pracuje ve staré kalkulačce) - řeší se opakovaným spuštěním migrace (idempotentní, viz 0012), ne automatickou synchronizací.
- Vyhnuli jsme se riziku nekonzistence dvou souběžně zapisovaných databází, které by dual-write přinesl.
- Aktivace nového modelu (`tpvSettings.newTpvModelEnabled`) je záměrně oddělená od migrace samotné a v tomto kroku zůstává `false` - přepnutí UI je práce budoucího kroku.
